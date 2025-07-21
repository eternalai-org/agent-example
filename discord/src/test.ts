import dotenv from 'dotenv';
dotenv.config();
import { getServerChanels } from './discord';
import { Message } from 'discord.js/typings';
import { DiscordMessages, DiscordSummaries, syncDB } from './database';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { Op } from 'sequelize';
import { removeThinking } from './utils/helpers';

interface MessageData {
    channel_id: bigint;
    channel: string;
    id: bigint;
    author: string;
    content: string;
    timestamp: Date;
}

function convertDateToSnowflakeID(date: Date): string {
    // Discord epoch (January 1, 2015 00:00:00 UTC)
    const DISCORD_EPOCH = 1420070400000;
    // Get timestamp in milliseconds and subtract Discord epoch
    const timestamp = BigInt(date.getTime()) - BigInt(DISCORD_EPOCH);
    // Shift timestamp left by 22 bits to align with Snowflake structure
    // Worker ID, Process ID, and Sequence Number are set to 0
    const snowflake = (timestamp << 22n);
    // Return as string to handle 64-bit integer
    return snowflake.toString();
}

function convertSnowflakeIDToDate(snowflake: string): Date {
    // Discord epoch (January 1, 2015 00:00:00 UTC)
    const DISCORD_EPOCH = 1420070400000;
    // Convert snowflake string to bigint and extract timestamp
    const timestamp = (BigInt(snowflake) >> 22n) + BigInt(DISCORD_EPOCH);
    // Convert to Date object
    return new Date(Number(timestamp));
}

export const syncDiscordMessagesForChannel = async (serverId: string, channel: any) => {
    let lastId: string | undefined;
    const msg = await DiscordMessages.findOne(
        {
            where: {
                channel_id: channel.id,
            },
            order: [['id', 'DESC']],
        }
    )
    if (msg) {
        lastId = msg.dataValues.id as string
    }
    while (true) {
        const messages = await channel.messages.fetch({
            limit: 100,
            after: lastId,
        });
        if (messages.size === 0) break;
        for (var i = messages.size - 1; i >= 0; i--) {
            const message = messages.at(i) as Message;
            if (message.author.bot) continue;
            if (message.content && message.content.trim().length === 0) continue;
            const msgData = {
                server_id: serverId,
                channel_id: channel.id,
                channel: channel.name,
                id: message.id,
                author: message.author.tag,
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
        lastId = messages.last()?.id;
        if (messages.size < 100) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

export const syncDiscordMessagesForServer = async () => {
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
    const channels = await getServerChanels(botToken, serverId);
    for (const [id, channel] of channels) {
        try {
            console.log(`Syncing messages for channel ${channel.name}`);
            await syncDiscordMessagesForChannel(serverId, channel)
            console.log(`Synced messages for channel ${channel.name}`);
        } catch (error) {
            console.log(`Cannot sync messages for channel ${channel.name}: ${error}`);
        }
    }
}

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

export const analyzeMessages = async (messages: MessageData[]) => {
    const { text } = await generateText({
        model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
        maxSteps: 25,
        system: `
        You are a Discord Message Analyzer.
        `.trim(),
        messages: [
            {
                role: 'user',
                content: `
                You are given a list of messages and you need to analyze them by topic. You help users understand what topics are being discussed in the messages.
                You need to return a summary of the messages with json format and not include explanation.
                The json format is:
                [
                    {
                        "topic": "string",
                        "number_of_messages": "number",
                        "number_of_users": "number"
                    },
                    ...
                ]
                The topic should be specific and not too general. Ignore casual conversation, test messages, and messages that are not related to the topic.
                The number of messages should be the number of messages that have the same topic or discuss in the same topic.

                The messages are:

                ${messages.map((message) => `- ${message.author} : ${message.content}`).join('\n')}
                `
            }
        ],
    });
    const result = removeThinking(text)
    return result
}

export const summarizeForChannel = async (channelId: string) => {
    while (true) {
        var lastId: string | undefined;
        const summary = await DiscordSummaries.findOne({
            where: {
                channel_id: channelId,
            },
            order: [['to_timestamp', 'DESC']],
        })
        if (summary) {
            lastId = convertDateToSnowflakeID(summary.dataValues.to_timestamp as Date)
        } else {
            lastId = convertDateToSnowflakeID(new Date(new Date().getTime() - 24 * 60 * 60 * 1000))
        }
        const messages = await DiscordMessages.findAll({
            where: {
                channel_id: channelId,
                id: {
                    [Op.gte]: lastId,
                }
            },
            order: [['id', 'ASC']],
            limit: 100,
        })
        if (messages.length < 50) break
        const text = await analyzeMessages(messages.map((message) => ({
            channel_id: message.dataValues.channel_id,
            channel: message.dataValues.channel,
            id: message.dataValues.id,
            author: message.dataValues.author,
            content: message.dataValues.content,
            timestamp: message.dataValues.timestamp,
        })))
        await DiscordSummaries.create({
            channel_id: channelId,
            summary: text,
            from_timestamp: messages[0].dataValues.timestamp,
            to_timestamp: messages[messages.length - 1].dataValues.timestamp,
        })
    }
}

export const summarizeAllChannels = async () => {
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
        const channels = await getServerChanels(botToken, serverId);
        for (const [id, channel] of channels) {
            try {
                console.log(`Summarizing channel ${channel.name}`);
                await summarizeForChannel(id)
                console.log(`Summarized channel ${channel.name}`);
            } catch (error) {
                console.log(`Cannot summarize channel ${channel.name}: ${error}`);
            }
        }
    } catch (error) {
        console.log(`Cannot summarize all channels: ${error}`);
    }
}

(async () => {
    // console.log('Hello World', convertSnowflakeIDToDate('1395680212410175549'));
    // console.log('Hello World', convertDateToSnowflakeID(new Date()));
    await syncDB()
    await syncDiscordMessagesForServer()
    // const messages = await DiscordMessages.findAll({
    //     where: {
    //         timestamp: {
    //             [Op.gte]: new Date(Date.now() - 1000 * 60 * 60 * 24),
    //         }
    //     },
    //     order: [['timestamp', 'ASC']],
    //     limit: 100,
    // })
    // messages.forEach(async (message) => {
    //     const { dataValues } = message
    //     console.log(dataValues)
    // })
    // const text = await analyzeMessages(messages.map((message) => ({
    //     channel_id: message.dataValues.channel_id,
    //     channel: message.dataValues.channel,
    //     id: message.dataValues.id,
    //     author: message.dataValues.author,
    //     content: message.dataValues.content,
    //     timestamp: message.dataValues.timestamp,
    // })))
    // console.log(text)
})()