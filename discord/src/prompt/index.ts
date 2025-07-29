import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from "zod";
import { DiscordChannels, DiscordMessages, DiscordServers, DiscordSummaries } from '../services/database';
import { Op } from 'sequelize';
import { needSyncDiscordChannels, needSyncDiscordServers, postDiscordMessage, summarizeMessagesForAllChannels, syncDiscordChannelsForServer, syncDiscordMessagesForChannel, syncDiscordMessagesForServer, syncDiscordServers } from '../services';
import { Page } from 'playwright';
import { checkAuthorizedToDiscord, getDiscordChannels, getDiscordMessagesForChannel } from '../services/playwright';
import { SYNC_TIME_RANGE } from '../services/types';
import { channel } from 'diagnostics_channel';

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

export const sendPrompt = async (
    page: Page | null,
    request: { env: any, messages: any[] },
    callAgentFunc: (delta: string) => Promise<void>
): Promise<any> => {
    try {
        const { textStream } = streamText({
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: `You are a Discord server analysis assistant. Your role is to help users analyze and understand conversations in their Discord servers. You use chromium browser to login to Discord and get the data.

            Available tools:

            1. getDiscordServers
            - Lists all accessible Discord servers
            - Returns: server ID and name
            - Use this first to identify the target server

            2. getAllChannels
            - Lists all channels in a specified server
            - Returns: channel ID, name and type
            - Required before accessing channel data

            3. getDiscordSummaries
            - Provides topic-based message summaries
            - Includes message counts, participant counts, and timeframes
            - Can analyze single channel or entire server
            - Use this for high-level conversation analysis

            4. getRecentMessages
            - Fetches recent messages from a channel
            - Returns: message ID, content, author, timestamp, reply to message id
            - Use for detailed message-level analysis

            5. postMessageToChannel
            - Sends a message to a specified channel
            - Requires channel ID and message content

            Guidelines:
            1. Always verify server and channel IDs before analysis
            2. Work with summaries for efficiency with large datasets
            3. Provide clear, actionable insights about:
               - Active discussion topics
               - Channel engagement levels
               - Cross-channel conversation patterns
               - Notable trends or changes in activity

            Remember to maintain a helpful, analytical tone and focus on delivering meaningful insights about server activity.

            Note: 
            - If you are not authorized to Discord, you will need to login to Discord only via the browser.
            - You should always include complete server information (id, name) and channel information (id, name) in all responses.
            - Format server info as: Server: {id} - {name}
            - Format channel info as: Channel: {id} - {name} ({type})
            `.trim(),
            tools: {
                getDiscordServers: {
                    description: 'Get all servers. This is a list of all servers (id, name). You can use this to get the server id to get the channels of the server or get the summaries of the channels.',
                    parameters: z.object({}),
                    execute: async (args) => {
                        console.log('getDiscordServers', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            await checkAuthorizedToDiscord(page)
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                        <action>Executing <b>syncing servers</b></action>
                                    `.trim())
                            }
                            await syncDiscordServers(page)
                            const servers = await DiscordServers.findAll({
                                where: {
                                },
                            });
                            return servers.map((server) => {
                                return {
                                    id: server.dataValues.id,
                                    name: server.dataValues.name,
                                }
                            });
                        } catch (error) {
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    }
                },
                getAllChannels: {
                    description: 'Get all channels of the server. This is a list of all channels in the server (id, name). You can use this to get the channel id to get the summaries of the channels, recent messages or post messages to the channels.',
                    parameters: z.object({
                        server_id: z.string().optional().describe('The server id to get the channels for. You can use getDiscordServers to get the server id.'),
                    }),
                    execute: async (args) => {
                        console.log('getAllChannels', args)
                        try {
                            if (!args.server_id) {
                                throw new Error('server_id is required');
                            }
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            await checkAuthorizedToDiscord(page)
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                        <action>Executing <b>syncing channels</b></action>
                                    `.trim())
                            }
                            await syncDiscordChannelsForServer(page, args.server_id)
                            const channels = await DiscordChannels.findAll({
                                where: {
                                    server_id: args.server_id,
                                },
                            });
                            return channels.map((channel) => {
                                return {
                                    id: channel.dataValues.id,
                                    name: channel.dataValues.name,
                                }
                            });
                        } catch (error) {
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    },
                },
                getRecentMessages: {
                    description: 'Get recent messages from the channel. This is a list of recent messages from the channel (id, content, author, timestamp).',
                    parameters: z.object({
                        channel_id: z.string().describe('The channel id to get the recent messages for. You can use getAllChannels to get the channel id.')
                    }),
                    execute: async (args: { channel_id: string }) => {
                        console.log('getRecentMessages', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            await checkAuthorizedToDiscord(page)
                            const channel = await DiscordChannels.findOne({
                                where: {
                                    id: args.channel_id,
                                },
                            });
                            if (!channel) {
                                throw new Error('Channel not found');
                            }
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>syncing messages</b></action>
                                `.trim())
                            }
                            await syncDiscordMessagesForChannel(page, channel.dataValues.server_id, args.channel_id)
                            const messages = await DiscordMessages.findAll({
                                where: {
                                    server_id: channel.dataValues.server_id,
                                    channel_id: args.channel_id,
                                    bot: false,
                                },
                                order: [['timestamp', 'DESC']],
                                limit: 200,
                            });
                            messages.reverse()
                            return messages.map((message) => {
                                return {
                                    id: message.dataValues.id,
                                    author_id: message.dataValues.author_id,
                                    author: message.dataValues.author,
                                    content: message.dataValues.content,
                                    timestamp: message.dataValues.timestamp,
                                    reply_to_id: message.dataValues.reply_to_id,
                                }
                            });
                        } catch (error) {
                            console.log('getRecentMessages error', error)
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    },
                },
                postMessageToChannel: {
                    description: 'Post a message to the channel. This is a message to the channel (content).',
                    parameters: z.object({
                        channel_id: z.string().describe('The channel id to post the message to. You can use getAllChannels to get the channel id.'),
                        message: z.string().describe('The message to post to the channel.'),
                    }),
                    execute: async (args: { channel_id: string, message: string }) => {
                        console.log('postMessageToChannel', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            await checkAuthorizedToDiscord(page)
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>posting message to channel</b></action>
                                `.trim())
                            }
                            const channel = await DiscordChannels.findOne({
                                where: {
                                    id: args.channel_id,
                                },
                            });
                            if (!channel) {
                                throw new Error('Channel not found');
                            }
                            await postDiscordMessage(page, channel.dataValues.server_id, args.channel_id, args.message)
                            return `Message posted to channel ${args.channel_id}`
                        } catch (error) {
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    }
                },
                getDiscordSummaries: {
                    description: 'Get summaries of channel messages grouped by topic and time range. Each summary includes the number of messages and users discussing each topic.',
                    parameters: z.object({
                        server_id: z.string().describe('The server id to get the summaries for. You can use getDiscordServers to get the server id.'),
                        channel_id: z.string().optional().describe('The channel id to get the summaries for. You can use getAllChannels to get the channel id. If not provided, all channels will be returned.'),
                    }),
                    execute: async (args: { server_id: string, channel_id?: string }) => {
                        console.log('getDiscordSummaries', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            await checkAuthorizedToDiscord(page)
                            if (!args.server_id) {
                                throw new Error('server_id is required');
                            }
                            if (!args.channel_id) {
                                if (callAgentFunc) {
                                    await callAgentFunc(`
                                        <action>Executing <b>syncing channels</b></action>
                                    `.trim())
                                }
                                await syncDiscordChannelsForServer(page, args.server_id)
                            }
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>syncing messages</b></action>
                                `.trim())
                            }
                            await syncDiscordMessagesForServer(page, args.server_id, args.channel_id)
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>summarizing messages</b></action>
                                `.trim())
                            }
                            await summarizeMessagesForAllChannels(args.server_id, args.channel_id)
                            var fromTimestamp = new Date(Date.now() - SYNC_TIME_RANGE);
                            const whereMap: any = {
                                server_id: args.server_id,
                                to_timestamp: {
                                    [Op.gte]: fromTimestamp,
                                },
                            }
                            if (args.channel_id) {
                                whereMap.channel_id = args.channel_id;
                            }
                            const summaries = await DiscordSummaries.findAll({
                                where: whereMap,
                                order: [['to_timestamp', 'ASC']],
                            });
                            const channelWhereMap: any = {
                                server_id: args.server_id,
                            }
                            if (args.channel_id) {
                                channelWhereMap.id = args.channel_id;
                            }
                            const channels = await DiscordChannels.findAll({
                                where: channelWhereMap,
                                order: [['name', 'ASC']],
                            });
                            return {
                                channels: channels.map((channel: any) => {
                                    return {
                                        id: channel.dataValues.id,
                                        name: channel.dataValues.name,
                                    }
                                }),
                                summaries: summaries.map((summary) => {
                                    var summaries: any = []
                                    try {
                                        summaries = JSON.parse(summary.dataValues.summary)
                                    } catch (error) {
                                        summaries = summary.dataValues.summary
                                    }
                                    return {
                                        channel_id: summary.dataValues.channel_id,
                                        summaries: summaries,
                                        from_timestamp: summary.dataValues.from_timestamp,
                                        to_timestamp: summary.dataValues.to_timestamp,
                                    }
                                })
                            };
                        } catch (error) {
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    },
                },
            },
            messages: request.messages,
        });
        return textStream;
    } catch (error) {
        console.log('sendPrompt error', error)
        throw new Error('Failed to send prompt');
    }
}