import { Message } from "discord.js";
import { DiscordChannels, DiscordMessages, DiscordSummaries } from "./database";
import { getServerChanels } from "./discord";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Op } from "sequelize";
import { convertDateToSnowflakeID, removeThinking } from "./helpers";
import { MessageData, SYNC_TIME_RANGE } from "./types";
import { chatMessageWithLLM } from "./llm";
import { Mutex } from "async-mutex";
import { getDiscordChannels, getDiscordMessagesForChannel } from "./playwright";
import { chromium, Page } from "playwright";

const discordMtx = new Mutex()

export const newChromiumPage = async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage()
    await page.goto('https://discord.com/login', { waitUntil: 'networkidle' });
    return page
}

// export const syncDiscordMessagesForChannel = async (serverId: string, channel: any) => {
//     console.log('syncDiscordMessagesForChannel', serverId, channel.id)
//     await discordMtx.runExclusive(async () => {
//         while (true) {
//             const msg = await DiscordMessages.findOne(
//                 {
//                     where: {
//                         channel_id: channel.id,
//                     },
//                     order: [['id', 'DESC']],
//                 }
//             )
//             var lastId = convertDateToSnowflakeID(new Date(new Date().getTime() - SYNC_TIME_RANGE))
//             if (msg) {
//                 const msgId = msg.dataValues.id as string
//                 if (lastId < msgId) {
//                     lastId = msgId
//                 }
//             }
//             const messages = await channel.messages.fetch({
//                 limit: 100,
//                 after: lastId,
//             });
//             if (messages.size === 0) break;
//             for (var i = messages.size - 1; i >= 0; i--) {
//                 const message = messages.at(i) as Message;
//                 const msgData = {
//                     server_id: serverId,
//                     channel_id: channel.id,
//                     channel: channel.name,
//                     id: message.id,
//                     author: message.author.username,
//                     author_id: message.author.id,
//                     bot: message.author.bot,
//                     content: message.content,
//                     timestamp: message.createdAt,
//                 }
//                 try {
//                     await DiscordMessages.create(
//                         msgData
//                     )
//                 } catch (error) {
//                 }
//                 console.log('msgData', msgData)
//             }
//             if (messages.size < 100) break;
//             await new Promise((resolve) => setTimeout(resolve, 500));
//         }
//     })
// }

// export const syncDiscordMessagesForServer = async (channelId?: string) => {
//     const botToken = process.env.DISCORD_BOT_TOKEN;
//     const serverId = process.env.DISCORD_SERVER_ID;
//     if (!botToken) {
//         console.log('DISCORD_BOT_TOKEN is not set');
//         return;
//     }
//     if (!serverId) {
//         console.log('DISCORD_SERVER_ID is not set');
//         return;
//     }
//     console.log(`Syncing messages for server ${serverId}`);
//     const channels = await getServerChanels(botToken, serverId);
//     for (const [id, channel] of channels) {
//         if (channelId && id !== channelId) continue;
//         try {
//             console.log(`Syncing messages for channel ${channel.name}`);
//             await syncDiscordMessagesForChannel(serverId, channel)
//             console.log(`Synced messages for channel ${channel.name}`);
//         } catch (error) {
//             console.log(`Cannot sync messages for channel ${channel.name}: ${error}`);
//         }
//     }
//     console.log(`Synced messages for server ${serverId}`);
// }

export const syncDiscordChannelsForServer = async (page: Page, serverId: string) => {
    await discordMtx.runExclusive(async () => {
        try {
            console.log(`Syncing channels for server ${serverId}`)
            const channels = await getDiscordChannels(page, serverId)
            await DiscordChannels.destroy({
                where: {
                    server_id: serverId,
                },
            })
            for (const channel of channels) {

                const existingChannel = await DiscordChannels.findOne({
                    where: {
                        id: channel.id,
                    },
                })
                if (existingChannel) {
                    // update channel
                    await DiscordChannels.update({
                        name: channel.name,
                    }, {
                        where: {
                            id: channel.id,
                        },
                    })
                } else {
                    // create channel
                    await DiscordChannels.create({
                        id: channel.id,
                        server_id: serverId,
                        name: channel.name,
                    })
                }
            }
            console.log(`Synced channels for server ${serverId}`)
        } catch (error) {
            console.log(`Cannot sync channels for server ${serverId}: ${error}`);
        }
    })
}

export const syncDiscordMessagesForChannel = async (page: Page, serverId: string, channelId: string) => {
    await discordMtx.runExclusive(async () => {
        try {
            console.log(`Syncing messages for channel ${channelId}`)
            // delete old messages
            await DiscordMessages.destroy({
                where: {
                    server_id: serverId,
                    channel_id: channelId,
                    timestamp: {
                        [Op.lt]: new Date(Date.now() - SYNC_TIME_RANGE),
                    },
                },
            })
            const channel = await DiscordChannels.findOne({
                where: {
                    id: channelId,
                    server_id: serverId,
                },
            })
            if (!channel) {
                throw new Error(`Channel ${channelId} not found`)
            }
            var lastId = 'none'
            const existingMessages = await DiscordMessages.findOne({
                where: {
                    server_id: serverId,
                    channel_id: channelId,
                },
                order: [['id', 'DESC']],
            })
            if (existingMessages) {
                lastId = existingMessages.dataValues.id
            }
            const messages = await getDiscordMessagesForChannel(page, serverId, channelId, lastId, SYNC_TIME_RANGE)
            for (const message of messages) {
                try {
                    const existingMessage = await DiscordMessages.findOne({
                        where: {
                            id: message.id,
                        },
                    })
                    if (existingMessage) {
                        await DiscordMessages.update({
                            server_id: serverId,
                            channel_id: channel.dataValues.id,
                            channel: channel.dataValues.name,
                            author: message.author,
                            author_id: message.author_id,
                            content: message.content,
                            timestamp: new Date(message.timestamp),
                            bot: false,
                        }, {
                            where: {
                                id: message.id,
                            },
                        })
                    } else {
                        await DiscordMessages.create({
                            server_id: serverId,
                            channel_id: channel.dataValues.id,
                            channel: channel.dataValues.name,
                            id: message.id,
                            author: message.author,
                            author_id: message.author_id,
                            content: message.content,
                            timestamp: new Date(message.timestamp),
                            bot: false,
                        })
                    }
                } catch (error) {
                    console.log(`Cannot sync message ${message.id}: ${error}`);
                }
            }
            console.log(`Synced messages for channel ${channelId}`)
        } catch (error) {
            console.log(`Cannot sync messages for channel ${channelId}: ${error}`);
        }
    })
}

export const syncDiscordMessagesForServer = async (page: Page, serverId: string) => {
    try {
        console.log(`Syncing messages for server ${serverId}`)
        const channels = await DiscordChannels.findAll({
            where: {
                server_id: serverId,
            },
        })
        for (const channel of channels) {
            try {
                await syncDiscordMessagesForChannel(page, serverId, channel.dataValues.id)
            } catch (error) {
            }
        }
        console.log(`Synced messages for server ${serverId}`)
    } catch (error) {
        console.log(`Cannot sync messages for server ${serverId}: ${error}`);
    }
}

export const analyzeMessages = async (messages: MessageData[]) => {
    if (messages.length === 0) return '';
    console.log('analyzeMessages', messages[0].timestamp, messages[messages.length - 1].timestamp)
    return await chatMessageWithLLM(
        `
        You are a Discord Message Analyzer. Your role is to identify and categorize meaningful discussion topics from Discord conversations.

        Guidelines:
        - Focus on substantive topics and discussions
        - Ignore casual chatter, greetings, and test messages
        - Be specific with topic names (e.g. "React Component Testing" vs just "Programming")
        - Group related messages even if they use slightly different terminology
        - Only count messages that actively contribute to a topic
        - Track unique users participating in each topic

        You must output your analysis as a JSON array with this exact format:
        [
          {
            "topic": "Specific topic name",
            "number_of_messages": Number of messages about this topic,
            "number_of_users": Number of unique users discussing this topic
          }
        ]

        Do not include any explanation or other text - only output valid JSON.
        `,
        `
        Analyze these messages by topic according to the guidelines above:

        ${messages.map((message) => `- ${message.author} <@${message.author_id}> : ${message.content}`).join('\n')}
        `
    )
}

export const summarizeMessagesForChannel = async (serverId: string, channelId: string) => {
    console.log('summarizeMessagesForChannel', serverId, channelId)
    await discordMtx.runExclusive(async () => {
        // delete old summaries
        await DiscordSummaries.destroy({
            where: {
                server_id: serverId,
                channel_id: channelId,
                to_timestamp: {
                    [Op.lt]: new Date(Date.now() - SYNC_TIME_RANGE),
                },
            },
        })
        while (true) {
            var lastId: string | undefined;
            const summary = await DiscordSummaries.findOne({
                where: {
                    server_id: serverId,
                    channel_id: channelId,
                },
                order: [['to_timestamp', 'DESC']],
            })
            var summaryUpdated: any = null
            if (summary) {
                if (summary.dataValues.num_messages < 200) {
                    lastId = convertDateToSnowflakeID(summary.dataValues.from_timestamp as Date)
                    summaryUpdated = summary
                } else {
                    lastId = convertDateToSnowflakeID(summary.dataValues.to_timestamp as Date)
                }
            } else {
                lastId = convertDateToSnowflakeID(new Date(new Date().getTime() - SYNC_TIME_RANGE))
            }
            const messages = await DiscordMessages.findAll({
                where: {
                    server_id: serverId,
                    channel_id: channelId,
                    id: {
                        [Op.gt]: lastId,
                    },
                    bot: {
                        [Op.eq]: false,
                    }
                },
                order: [['id', 'ASC']],
                limit: 200,
            })
            if (messages.length < 20 || (summaryUpdated && summaryUpdated.dataValues.num_messages >= messages.length)) break
            const text = await analyzeMessages(messages.map((message) => ({
                channel_id: message.dataValues.channel_id,
                channel: message.dataValues.channel,
                id: message.dataValues.id,
                author: message.dataValues.author,
                author_id: message.dataValues.author_id,
                content: message.dataValues.content,
                timestamp: message.dataValues.timestamp,
            })))
            if (text) {
                if (summaryUpdated) {
                    await DiscordSummaries.update({
                        summary: text,
                        num_messages: messages.length,
                        from_timestamp: messages[0].dataValues.timestamp,
                        to_timestamp: messages[messages.length - 1].dataValues.timestamp,
                    }, {
                        where: {
                            id: summaryUpdated.dataValues.id,
                        }
                    })
                } else {
                    await DiscordSummaries.create({
                        server_id: serverId,
                        channel_id: channelId,
                        summary: text,
                        num_messages: messages.length,
                        from_timestamp: messages[0].dataValues.timestamp,
                        to_timestamp: messages[messages.length - 1].dataValues.timestamp,
                    })
                }
            }
            if (messages.length < 200) break
        }
    })
}

export const summarizeMessagesForAllChannels = async (channelId?: string) => {
    try {
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const serverId = process.env.DISCORD_SERVER_ID;
        if (!botToken) {
            console.log('DISCORD_BOT_TOKEN is not set');
            return;
        }
        if (!serverId) {
            console.log('DISCORD_SERVER_ID is not set');
            return;
        }
        console.log('Summarizing all channels for server', serverId);
        const channels = await getServerChanels(botToken, serverId);
        for (const [id, channel] of channels) {
            if (channelId && id !== channelId) continue;
            try {
                console.log(`Summarizing channel ${channel.name}`);
                await summarizeMessagesForChannel(serverId, id)
                console.log(`Summarized channel ${channel.name}`);
            } catch (error) {
                console.log(`Cannot summarize channel ${channel.name}: ${error}`);
            }
        }
        console.log('Summarized all channels for server', serverId);
    } catch (error) {
        console.log(`Cannot summarize all channels: ${error}`);
    }
}

export const deleteOldSummaries = async () => {
    console.log('Deleting old summaries')
    try {
        await DiscordSummaries.destroy({
            where: {
                to_timestamp: {
                    [Op.lt]: new Date(Date.now() - SYNC_TIME_RANGE),
                },
            },
        })
    } catch (error) {
        console.log(`Cannot delete old summaries: ${error}`);
    }
    console.log('Deleted old summaries')
}

export const deleteOldMessages = async () => {
    console.log('Deleting old messages')
    try {
        await DiscordMessages.destroy({
            where: {
                timestamp: {
                    [Op.lt]: new Date(Date.now() - SYNC_TIME_RANGE),
                },
            },
        })
    } catch (error) {
        console.log(`Cannot delete old messages: ${error}`);
    }
    console.log('Deleted old messages')
}

export const jobSyncDiscordMessagesAndSummarize = async () => {
    while (true) {
        console.log('Syncing discord messages and summarizing')
        try {
            await deleteOldSummaries()
            await deleteOldMessages()
            // await syncDiscordMessagesForServer()
            await summarizeMessagesForAllChannels()
            console.log('Synced discord messages and summarized')
        } catch (error) {
            console.log(`Cannot sync discord messages and summarize: ${error}`);
        }
        // sleep 5 minutes
        console.log('Sleeping for 5 minutes')
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000))
    }
}