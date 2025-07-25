import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from "zod";
import { DiscordChannels, DiscordMessages, DiscordServers, DiscordSummaries } from '../services/database';
import { Op } from 'sequelize';
import { needSyncDiscordChannels, needSyncDiscordServers, postDiscordMessage, summarizeMessagesForAllChannels, syncDiscordChannelsForServer, syncDiscordMessagesForChannel, syncDiscordMessagesForServer, syncDiscordServers } from '../services';
import { Page } from 'playwright';
import { getDiscordChannels, getDiscordMessagesForChannel } from '../services/playwright';
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
            system: `You are a Discord server analysis assistant. You help users understand the discussions and activities happening in their Discord server by analyzing message summaries.

            You have access to the following tools:

            1. getDiscordServers: Lists all servers with their IDs and names. Use this to identify specific servers.

            2. getAllChannels: Lists all channels in the server with their IDs, names and types. Use this to identify specific channels.

            3. getDiscordSummaries: Retrieves topic-based summaries of channel messages, including:
               - Number of messages per topic
               - Number of users discussing each topic
               - Time range of messages
               - Can analyze specific channels or all channels

            4. getRecentMessages: Retrieves recent messages from a channel, including:
                - Channel ID
                - List of messages (id, content, author, timestamp)

            5. postMessageToChannel: Posts a message to a channel, including:
                - Channel ID
                - Message content

            Important notes:
            - Always check channel names/IDs before analyzing specific channels
            - Due to data volume, you work with pre-generated summaries rather than raw messages
            
            Focus on helping users understand:
            - What topics are being discussed
            - How active different channels are
            - Trends in discussions across channels
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
                            if (await needSyncDiscordServers()) {
                                if (callAgentFunc) {
                                    await callAgentFunc(`
                                        <action>Executing <b>syncing servers</b></action>
                                    `.trim())
                                }
                                await syncDiscordServers(page)
                            }
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
                        server_id: z.string().optional().describe('The server id to get the channels for. The server id is the id of the server in the Discord.'),
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
                            if (await needSyncDiscordChannels(args.server_id)) {
                                if (callAgentFunc) {
                                    await callAgentFunc(`
                                        <action>Executing <b>syncing channels</b></action>
                                    `.trim())
                                }
                                await syncDiscordChannelsForServer(page, args.server_id)
                            }
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
                        channel_id: z.string().describe('The channel id to get the recent messages for. The channel id is the id of the channel in the server.')
                    }),
                    execute: async (args: { channel_id: string }) => {
                        console.log('getRecentMessages', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
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
                        channel_id: z.string().describe('The channel id to post the message to. The channel id is the id of the channel in the server.'),
                        message: z.string().describe('The message to post to the channel.'),
                    }),
                    execute: async (args: { channel_id: string, message: string }) => {
                        console.log('postMessageToChannel', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
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
                        server_id: z.string().describe('The server id to get the summaries for. The server id is the id of the server in the Discord.'),
                        channel_id: z.string().optional().describe('The channel id to get the summaries for. The channel id is the id of the channel in the server. If not provided, all channels will be returned.'),
                    }),
                    execute: async (args: { server_id: string, channel_id?: string }) => {
                        console.log('getDiscordSummaries', args)
                        try {
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            if (!args.server_id) {
                                throw new Error('server_id is required');
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
                                    return {
                                        channel_id: summary.dataValues.channel_id,
                                        summaries: JSON.parse(summary.dataValues.summary),
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