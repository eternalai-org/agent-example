import { logger } from '../utils/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { z } from "zod";
import axios, { AxiosResponse } from "axios";

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

export const getServerSystemPrompt = async () => {
    const res: AxiosResponse<{ result: { system_prompt: string } }> = await axios.get(
        `https://agent.api.eternalai.org/api/agent/app-config?network_id=${process.env.NETWORK_ID}&agent_name=telegram`,
    );
    return res.data.result.system_prompt;
}

// Function to extract address from bearer token
const extractAddressFromIdentityToken = (identityToken: string): string | null => {
    try {
        // Base64 decode the identity token
        const decodedToken = Buffer.from(identityToken, 'base64').toString('utf-8');

        // Parse the JSON data
        const tokenData = JSON.parse(decodedToken);

        // Extract the address field
        if (tokenData && tokenData.address) {
            return tokenData.address;
        }

        return null;
    } catch (error) {
        console.error('Error extracting address from identity token:', error);
        return null;
    }
};

export const sendPrompt = async (
    identityToken: string,
    request: {
        env: any,
        messages: any[],
        stream: boolean,
    }
): Promise<any> => {

    // Extract address from bearer token
    const userAddress = extractAddressFromIdentityToken(identityToken);
    console.log('Extracted user address from bearer token:', userAddress);
    const botToken = (request.env && request.env.TELEGRAM_BOT_TOKEN) ? request.env.TELEGRAM_BOT_TOKEN : (process.env.TELEGRAM_BOT_TOKEN || '');
    const channelId = (request.env && request.env.TELEGRAM_CHANNEL_ID) ? request.env.TELEGRAM_CHANNEL_ID : (process.env.TELEGRAM_CHANNEL_ID || '');
    try {
        const params = {
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: await getServerSystemPrompt(),
            tools: {
                getBotToken: {
                    description: `get the bot token`,
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('execute getBotToken');
                        return botToken;
                    },
                },
                getBotInfo: {
                    description: 'get bot information and test connection to Telegram API',
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('execute getBotInfo');
                        try {
                            if (!botToken) {
                                return 'Bot token is not configured';
                            }
                            // Test connection to Telegram Bot API
                            const telegramApiUrl = `https://api.telegram.org/bot${botToken}/getMe`;
                            const res: AxiosResponse<{ ok: boolean; result?: any; description?: string }> = await axios.get(telegramApiUrl);

                            if (res.data.ok) {
                                const botInfo = res.data.result;
                                return `Bot connected successfully!\nBot Name: ${botInfo.first_name}\nUsername: @${botInfo.username}\nBot ID: ${botInfo.id}`;
                            } else {
                                return `Bot connection failed: ${res.data.description || 'Unknown error'}`;
                            }
                        } catch (error) {
                            logger.error('Error getting bot info:', error);
                            return 'Error getting bot info: ' + (error instanceof Error ? error.message : String(error));
                        }
                    },
                },
                getChannelID: {
                    description: `get the channel id of the user`,
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('execute getChannelID');
                        return channelId;
                    },
                },
                getChannelInfo: {
                    description: `get the channel info of the user`,
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('execute getChannelInfo');
                        try {
                            if (!channelId) {
                                return 'Channel ID is not configured';
                            }
                            const channelInfo = await axios.get(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${channelId}`);
                            return channelInfo.data;
                        } catch (error) {
                            logger.error('Error getting channel info:', error);
                            return 'Error getting channel info: ' + (error instanceof Error ? error.message : String(error));
                        }
                    },
                },
                postMessage: {
                    description: 'post the message with the given content',
                    parameters: z.object({
                        message: z.string().describe('The content of the message'),
                    }),
                    execute: async (args: { message: string }) => {
                        console.log('execute postMessage', args);
                        try {
                            if (!botToken) {
                                throw new Error('Telegram bot token is not configured');
                            }
                            if (!channelId) {
                                throw new Error('Telegram channel ID is not configured');
                            }
                            // Use Telegram Bot API directly
                            const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
                            const res: AxiosResponse<{ ok: boolean; result?: any; description?: string }> = await axios.post(
                                telegramApiUrl,
                                {
                                    chat_id: channelId,
                                    text: args.message,
                                    parse_mode: 'Markdown'
                                }
                            );
                            if (res.data.ok) {
                                return `Message sent successfully to channel ${channelId}`;
                            } else {
                                throw new Error(`Telegram API error: ${res.data.description || 'Unknown error'}`);
                            }
                        } catch (error) {
                            logger.error('Error posting message:', error);
                            return 'Error posting message: ' + (error instanceof Error ? error.message : String(error));
                        }
                    },
                },
            },
            messages: request.messages,
            onError: (error: any) => {
                logger.error('Error sending prompt:', error);
            }
        }
        if (request.stream) {
            const { textStream } = streamText(params);
            return textStream;
        } else {
            const { text } = await generateText(params);
            return text;
        }
    } catch (error) {
        logger.error('Error sending prompt:', error);
        throw new Error('Failed to send prompt');
    }
}