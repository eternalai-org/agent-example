import { Message } from "discord.js";
import { DiscordMessages, DiscordSummaries } from "./database";
import { getServerChanels } from "./discord";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Op } from "sequelize";
import { convertDateToSnowflakeID, removeThinking } from "./helpers";
import { MessageData } from "./types";
import { chatMessageWithLLM } from "./llm";
import { Mutex } from "async-mutex";

export const SYNC_TIME_RANGE = 15 * 24 * 60 * 60 * 1000

const discordMtx = new Mutex()

export const syncDiscordMessagesForChannel = async (serverId: string, channel: any) => {
    console.log('syncDiscordMessagesForChannel', serverId, channel.id)
    await discordMtx.runExclusive(async () => {
        while (true) {
            const msg = await DiscordMessages.findOne(
                {
                    where: {
                        channel_id: channel.id,
                    },
                    order: [['id', 'DESC']],
                }
            )
            var lastId = convertDateToSnowflakeID(new Date(new Date().getTime() - SYNC_TIME_RANGE))
            if (msg) {
                const msgId = msg.dataValues.id as string
                if (lastId < msgId) {
                    lastId = msgId
                }
            }
            const messages = await channel.messages.fetch({
                limit: 100,
                after: lastId,
            });
            if (messages.size === 0) break;
            for (var i = messages.size - 1; i >= 0; i--) {
                const message = messages.at(i) as Message;
                const msgData = {
                    server_id: serverId,
                    channel_id: channel.id,
                    channel: channel.name,
                    id: message.id,
                    author: message.author.username,
                    bot: message.author.bot,
                    content: message.content,
                    timestamp: message.createdAt,
                }
                try {
                    await DiscordMessages.create(
                        msgData
                    )
                } catch (error) {
                }
                console.log('msgData', msgData)
            }
            if (messages.size < 100) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    })
}

export const syncDiscordMessagesForServer = async (channelId?: string) => {
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
    console.log(`Syncing messages for server ${serverId}`);
    const channels = await getServerChanels(botToken, serverId);
    for (const [id, channel] of channels) {
        if (channelId && id !== channelId) continue;
        try {
            console.log(`Syncing messages for channel ${channel.name}`);
            await syncDiscordMessagesForChannel(serverId, channel)
            console.log(`Synced messages for channel ${channel.name}`);
        } catch (error) {
            console.log(`Cannot sync messages for channel ${channel.name}: ${error}`);
        }
    }
    console.log(`Synced messages for server ${serverId}`);
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

        ${messages.map((message) => `- ${message.author} : ${message.content}`).join('\n')}
        `
    )
}

export const summarizeMessagesForChannel = async (serverId: string, channelId: string) => {
    console.log('summarizeMessagesForChannel', serverId, channelId)
    await discordMtx.runExclusive(async () => {
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
                            id: summary?.dataValues?.id,
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

export const jobSyncDiscordMessagesAndSummarize = async () => {
    while (true) {
        try {
            await syncDiscordMessagesForServer()
            await summarizeMessagesForAllChannels()
        } catch (error) {
            console.log(`Cannot sync discord messages and summarize: ${error}`);
        }
        // sleep 5 minutes
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000))
    }
}