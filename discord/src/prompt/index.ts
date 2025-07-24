import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from "zod";
import { DiscordChannels, DiscordMessages, DiscordSummaries } from '../services/database';
import { Op } from 'sequelize';
import { postDiscordMessage, summarizeMessagesForAllChannels, syncDiscordChannelsForServer, syncDiscordMessagesForChannel, syncDiscordMessagesForServer } from '../services';
import { Page } from 'playwright';
import { getDiscordChannels, getDiscordMessagesForChannel } from '../services/playwright';
import { SYNC_TIME_RANGE } from '../services/types';

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
        const serverId = (request.env && request.env.DISCORD_SERVER_ID) ? request.env.DISCORD_SERVER_ID : (process.env.DISCORD_SERVER_ID || '');
        const { textStream } = streamText({
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: `You are a Discord server analysis assistant. You help users understand the discussions and activities happening in their Discord server by analyzing message summaries.

            You have access to the following tools:

            1. getAllChannels: Lists all channels in the server with their IDs, names and types. Use this to identify specific channels.

            2. getDiscordSummaries: Retrieves topic-based summaries of channel messages, including:
               - Number of messages per topic
               - Number of users discussing each topic
               - Time range of messages
               - Can analyze specific channels or all channels
               - Limited to past 7 days of data

            3. getRecentMessages: Retrieves recent messages from a channel, including:
                - Channel ID
                - List of messages (id, content, author, timestamp)

            Important notes:
            - Always check channel names/IDs before analyzing specific channels
            - Due to data volume, you work with pre-generated summaries rather than raw messages
            - Cannot provide summaries for periods beyond 7 days ago
            - When asked about older data, kindly explain this limitation
            
            Focus on helping users understand:
            - What topics are being discussed
            - How active different channels are
            - Trends in discussions across channels
            `.trim(),
            tools: {
                getAllChannels: {
                    description: 'Get all channels of the server. This is a list of all channels in the server (id, name, type). You can use this to get the channel id to get the summaries of the channels or recent messages.',
                    parameters: z.object({}),
                    execute: async (args) => {
                        console.log('getAllChannels', args)
                        try {
                            if (!serverId) {
                                throw new Error('DISCORD_SERVER_ID is not set');
                            }
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>syncing channels</b></action>
                                `.trim())
                            }
                            await syncDiscordChannelsForServer(page, serverId)
                            const channels = await DiscordChannels.findAll({
                                where: {
                                    server_id: serverId,
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
                            if (!serverId) {
                                throw new Error('DISCORD_SERVER_ID is not set');
                            }
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>syncing messages</b></action>
                                `.trim())
                            }
                            await syncDiscordMessagesForChannel(page, serverId, args.channel_id)
                            const messages = await DiscordMessages.findAll({
                                where: {
                                    server_id: serverId,
                                    channel_id: args.channel_id,
                                },
                                order: [['timestamp', 'DESC']],
                                limit: 200,
                            });
                            messages.reverse()
                            return messages.map((message) => {
                                return {
                                    id: message.dataValues.id,
                                    author: message.dataValues.author,
                                    content: message.dataValues.content,
                                    timestamp: message.dataValues.timestamp,
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
                            if (!serverId) {
                                throw new Error('DISCORD_SERVER_ID is not set');
                            }
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>posting message to channel</b></action>
                                `.trim())
                            }
                            await postDiscordMessage(page, serverId, args.channel_id, args.message)
                            return `Message posted to channel ${args.channel_id}`
                        } catch (error) {
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    }
                },
                getDiscordSummaries: {
                    description: 'Get summaries of channel messages grouped by topic and time range. Each summary includes the number of messages and users discussing each topic.',
                    parameters: z.object({
                        channel_id: z.string().optional().describe('The channel id to get the summaries for. The channel id is the id of the channel in the server. If not provided, all channels will be returned.'),
                    }),
                    execute: async (args: { channel_id: string }) => {
                        console.log('getDiscordSummaries', args)
                        try {
                            if (!serverId) {
                                throw new Error('DISCORD_SERVER_ID is not set');
                            }
                            if (!page) {
                                throw new Error('Page is not initialized');
                            }
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>syncing messages</b></action>
                                `.trim())
                            }
                            await syncDiscordMessagesForServer(page, serverId, args.channel_id)
                            if (callAgentFunc) {
                                await callAgentFunc(`
                                    <action>Executing <b>summarizing messages</b></action>
                                `.trim())
                            }
                            await summarizeMessagesForAllChannels(serverId, args.channel_id)
                            var fromTimestamp = new Date(Date.now() - SYNC_TIME_RANGE);
                            const whereMap: any = {
                                server_id: serverId,
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
                            const channels = await DiscordChannels.findAll({
                                where: {
                                    server_id: serverId,
                                },
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
            onError: (error) => {
                console.log('sendPromptWithMultipleAgents onError', error);
            },
            // onStepFinish: (step) => {
            //     console.log('sendPrompt onStepFinish', step)
            // }
        });
        return textStream;
    } catch (error) {
        console.log('sendPrompt error', error)
        throw new Error('Failed to send prompt');
    }
}