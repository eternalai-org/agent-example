import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { number, z } from "zod";
import { DiscordSummaries } from '../services/database';
import { Op } from 'sequelize';
import { summarizeMessagesForAllChannels, summarizeMessagesForChannel, SYNC_TIME_RANGE, syncDiscordMessagesForChannel, syncDiscordMessagesForServer } from '../services';
import { getServerChanels } from '../services/discord';

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

// export const startAgents = async (agents: { id: number, name: string, description: string, custom_env: string }[]): Promise<any> => {
//     for (const agent of agents) {
//         await startAgent(agent.id, agent?.custom_env || '');
//     }
// }

export const sendPrompt = async (
    request: { messages: any[] },
    callAgentFunc: (delta: string) => Promise<void>
): Promise<any> => {
    try {
        const botToken = process.env.DISCORD_BOT_TOKEN as string;
        const serverId = process.env.DISCORD_SERVER_ID as string;
        if (!serverId || !botToken) {
            throw new Error('Environment variables are not set');
        }
        const { textStream } = streamText({
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: `You are a Discord agent that can manage discord server.
            
            You can use the following tools to manage the discord server:
            
            Note:
            getDiscordSummaries: Get the summaries of the channels with time range.
            - channel_id: The channel id to get the summaries for. If not provided, all channels will be returned.
            - get all messages from server will be large data, so you need to get the summaries of the channels by time range first.
            - if duration is over 15 days, respond to user that you cannot get summaries beyond that time range.
            `,
            tools: {
                getAllChannels: {
                    description: 'Get all channels of the server. This is a list of all channels in the server (id, name, type). You can use this to get the channel id to get the summaries of the channels.',
                    parameters: z.object({}),
                    execute: async (args) => {
                        console.log('getAllChannels', args)
                        try {
                            const channels = await getServerChanels(botToken, serverId);
                            return channels.map((channel: any) => {
                                return {
                                    channel_id: channel.id,
                                    channel_name: channel.name,
                                    type: channel.type,
                                }
                            });
                        } catch (error) {
                            return `Error ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    },
                },
                getDiscordSummaries: {
                    description: 'Get summaries of channel messages grouped by topic and time range. Each summary includes the number of messages and users discussing each topic.',
                    parameters: z.object({
                        channel_id: z.string().optional().describe('The channel id to get the summaries for. The channel id is the id of the channel in the server. If not provided, all channels will be returned.'),
                    }),
                    execute: async (args: { channel_id: string }) => {
                        console.log('getDiscordSummaries', args)
                        try {
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
                            const channels = await getServerChanels(botToken, serverId);
                            return {
                                channels: channels.map((channel: any) => {
                                    return {
                                        channel_id: channel.id,
                                        channel_name: channel.name,
                                    }
                                }),
                                summaries: summaries.map((summary) => {
                                    return {
                                        channel_id: summary.dataValues.channel_id,
                                        summary: summary.dataValues.summary,
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
        });
        return textStream;
    } catch (error) {
        console.log('sendPrompt error', error)
        throw new Error('Failed to send prompt');
    }
}