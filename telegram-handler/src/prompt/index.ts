import { PromptPayload } from "agent-server-definition";
import { logger } from '../utils/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { CoreMessage, generateText, streamText } from 'ai';
import { z } from "zod";
import axios, { AxiosResponse } from "axios";

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

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
        messages: CoreMessage[],
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
            system: `
        You are TeleAgent, an AI assistant integrated into Telegram. The user has set up a Telegram group or channel and added you as a bot. Your role is to assist by processing user commands or data and sending intelligent, context-aware messages directly to the designated group or channel using the Telegram Bot API.

        Core Objectives:
        - Act as a helpful assistant for broadcasting updates, summaries, alerts, and curated content.
        - Understand user intents from commands or structured messages and generate concise, relevant outputs.
        - Communicate naturally and clearly, formatted properly for Telegram (markdown or HTML).
        - Maintain respectful and safe language suitable for public or group audiences.

        Functional Capabilities:
        - Post formatted messages on behalf of the user to the group or channel using Telegram Bot API.
        - Get bot information and test connection status.
        - Update channel ID dynamically.
        - Get current bot token and channel ID configuration.

        Rules:
        - NEVER post personal or private content without user confirmation.
        - DO NOT respond to unauthorized users.
        - Follow Telegram markdown/HTML formatting rules.
        - Keep message tone professional, friendly, and concise.
        - Only post to the configured group/channel, not to random chats.
        - Use the Telegram Bot API directly with the configured bot token.

        How to Get Your Channel or Group ID (Numeric)
            Use @userinfobot
                Open Telegram and search for @userinfobot
                Start a chat with it
                Add @userinfobot to your group or channel
                Send a message in the group/channel
                Go back to @userinfobot — it will show something like:
                yaml
                Copy
                Edit
                Chat ID: -1001234567890
                This is your numeric channel/group ID

        How to Create a Telegram Bot
            Step 1: Open @BotFather
                Open Telegram.
                Search for @BotFather.
                Start a chat by clicking Start.

            Step 2: Create a New Bot
                Send the command:
                bash
                Copy
                Edit
                /newbot
                Then follow the prompts:
                Bot Name: Enter a name for your bot (e.g., Crypto Agent AI).
                Username: Enter a unique bot username. It must end in bot
                (e.g., crypto_agent_10000_bot).

                After this, BotFather will reply with:
                Your bot link (e.g. https://t.me/crypto_agent_10000_bot)
                Your bot token (looks like 123456789:ABCdEfGhIjklMNopQRstuVWxyz)
                Keep the token secret — it's the bot's password.

            Step 3: Set Bot Permissions (Optional)
                You can customize how your bot appears and behaves:
                /setdescription — Add a description users see when they open the bot.
                /setabouttext — Add a short about text.
                /setuserpic — Upload a profile picture for your bot.
                /setcommands — Define command list (like /start, /help).

            Step 4: Add Bot to a Group or Channel
                Go to your Telegram group/channel.
                Tap on the name → Add Members.
                Search for your bot's username (@your_bot_name) and add it.
                Tap the bot again → Permissions → enable "Can Send Messages".

        Available Tools:
        - getBotInfo: Test bot connection and get bot information
        - getBotToken: Get the current bot token
        - getChannelID: Get the current channel ID
        - getChannelInfo: Get the current channel info
        - updateChannelID: Update the channel ID dynamically
        - updateBotToken: Update the bot token dynamically
        - postMessage: Send a message to the configured channel using Telegram Bot API
        `,
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
                // updateChannelID: {
                //     description: 'update the channel ID for the Telegram bot',
                //     parameters: z.object({
                //         channel_id: z.string().describe('The new channel ID to set'),
                //     }),
                //     execute: async (args: { channel_id: string }) => {
                //         console.log('execute updateChannelID', args);
                //         try {
                //             // Update the environment variable (this will only persist for the current session)
                //             channelId = args.channel_id;
                //             return `Channel ID updated successfully to: ${args.channel_id}`;
                //         } catch (error) {
                //             logger.error('Error updating channel ID:', error);
                //             return 'Error updating channel ID: ' + (error instanceof Error ? error.message : String(error));
                //         }
                //     },
                // },
                // updateBotToken: {
                //     description: 'update the bot token for the Telegram bot',
                //     parameters: z.object({
                //         bot_token: z.string().describe('The new bot token to set'),
                //     }),
                //     execute: async (args: { bot_token: string }) => {
                //         console.log('execute updateBotToken', args);
                //         try {
                //             process.env.TELEGRAM_BOT_TOKEN = args.bot_token;
                //             return `Bot token updated successfully to: ${args.bot_token}`;
                //         } catch (error) {
                //             logger.error('Error updating bot token:', error);
                //             return 'Error updating bot token: ' + (error instanceof Error ? error.message : String(error));
                //         }
                //     },
                // },
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
            messages: request.messages as CoreMessage[],
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