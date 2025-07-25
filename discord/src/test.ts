import dotenv from 'dotenv';
dotenv.config();
import { syncDB } from './services/database';
import { newChromiumPage, summarizeMessagesForAllChannels, summarizeMessagesForChannel } from './services';
import { convertSnowflakeIDToDate } from './services/helpers';
import { getRecentMessages } from './services/discord';

import { chromium } from 'playwright';
import { getDiscordChannels, getAllServers, getDiscordMessagesForChannel, gotoLoginPageAndWait, postMessageToChannel } from './services/playwright';

(async () => {
    // Launch Playwright browser
    // const browser = await chromium.launch({ headless: false });
    // const page = await browser.newPage();

    // await gotoLoginPageAndWait(page)

    // const channels = await getDiscordChannels(page, process.env.DISCORD_SERVER_ID || '')
    // console.log('channels', channels)
    // for (const channel of channels) {
    //     try {
    //         const messages = await getDiscordMessagesForChannel(page, process.env.DISCORD_SERVER_ID || '', channel.id, 'none')
    //         console.log('messages', messages)
    //     } catch (error) {
    //         console.log('error', error)
    //     }
    // }

    // const page = await newChromiumPage()

    // // await postMessageToChannel(page, process.env.DISCORD_SERVER_ID || '', process.env.DISCORD_CHANNEL_ID || '', 'Hello, world!')

    // const messages = await getDiscordMessagesForChannel(page, process.env.DISCORD_SERVER_ID || '', process.env.DISCORD_CHANNEL_ID || '', 'none')
    // console.log('messages', messages)

    // await summarizeMessagesForAllChannels(process.env.DISCORD_SERVER_ID || '', process.env.DISCORD_CHANNEL_ID || '')


})()