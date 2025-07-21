import dotenv from 'dotenv';
dotenv.config();
import { syncDB } from './services/database';
import { summarizeMessagesForAllChannels, summarizeMessagesForChannel, syncDiscordMessagesForChannel, syncDiscordMessagesForServer } from './services';
import { convertSnowflakeIDToDate } from './services/helpers';
import { getRecentMessages } from './services/discord';

(async () => {
    // console.log('Hello World', convertSnowflakeIDToDate('1371383018001928283'));
    // console.log('Hello World', convertDateToSnowflakeID(new Date()));
    // await syncDB()

    // await syncDiscordMessagesForServer()

    // await summarizeMessagesForAllChannels()

    // console.log(
    //     await getServerMemberCount(
    //         process.env.DISCORD_BOT_TOKEN || '',
    //         process.env.DISCORD_SERVER_ID || ''
    //     )
    // )

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