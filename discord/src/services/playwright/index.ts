import { ElementHandle, Page } from "playwright";
import { SYNC_TIME_RANGE } from "../types";
import { Mutex } from "async-mutex";

const discordMtx = new Mutex()

export const gotoLoginPageAndWait = async (page: Page) => {
    try {
        await page.goto('https://discord.com/login', { waitUntil: 'networkidle' });
    } catch (error) {
        throw new Error('Failed to login to Discord');
    }
}

export const checkAuthorizedToDiscord = async (page: Page) => {
    try {
        await page.waitForSelector('rect[mask="url(#svg-mask-status-online)"]', { timeout: 10 * 1000 });
    } catch (error) {
        try {
            await page.goto('https://discord.com/login', { waitUntil: 'networkidle' });
            await page.waitForSelector('rect[mask="url(#svg-mask-status-online)"]', { timeout: 10 * 1000 });
        } catch (error) {
            throw new Error('Not authorized to Discord');
        }
    }
}

export const getAllServers = async (page: Page) => {
    var err: any = null
    for (let index = 0; index < 3; index++) {
        try {
            const servers: any[] = []
            await discordMtx.runExclusive(async () => {
                await page.goto('https://discord.com/channels/@me', { waitUntil: 'networkidle' });
                await page.waitForSelector('div[role="group"][aria-label="Servers"]', { timeout: 60 * 1000 });
                const serverGroupElement = await page.$('div[role="group"][aria-label="Servers"]')
                if (!serverGroupElement) {
                    throw new Error('Failed to find server group')
                }
                const serverElements: ElementHandle[] = await serverGroupElement.$$('div')
                for (const serverElement of serverElements) {
                    const classValue = await serverElement.getAttribute('class')
                    if (classValue?.includes('blobContainer')) {
                        const serverName = await serverElement.getAttribute('data-dnd-name')
                        if (serverName) {
                            const serverId = (await (await serverElement.$('[role="treeitem"]'))?.getAttribute('data-list-item-id'))?.split('___')[1]
                            if (serverId) {
                                servers.push({
                                    id: serverId,
                                    name: serverName,
                                })
                            }
                        }
                    }
                }
            })
            return servers
        } catch (error) {
            err = error
        }
    }
    if (err) {
        throw err
    }
    return []
}

export const getDiscordChannels = async (page: Page, serverId: string) => {
    var err: any = null
    for (let index = 0; index < 3; index++) {
        try {
            const channels: any[] = []
            await discordMtx.runExclusive(async () => {
                await checkAuthorizedToDiscord(page)
                await page.goto(`https://discord.com/channels/${serverId}`);
                await page.waitForSelector('#channels', { timeout: 60 * 1000 });
                const channelScroller: ElementHandle | null = await page.$('#channels')
                if (!channelScroller) {
                    throw new Error('Failed to find channel scroller')
                }
                await channelScroller.evaluate((element) => {
                    element.scrollTo({ top: 0, behavior: 'smooth' });
                });
                await page.waitForTimeout(1500);
                const channelMap: any = {}
                const loadChannels = async () => {
                    const containerDefaultElements: ElementHandle[] = await page.$$('li')
                    for (const containerDefaultElement of containerDefaultElements) {
                        const aElements: ElementHandle[] = await containerDefaultElement.$$('a')
                        for (const aElement of aElements) {
                            const href = await aElement.getAttribute('href')
                            if (href?.includes(`/channels/${serverId}/`)) {
                                const channelId = href.split('/').pop() || ''
                                if (!channelMap[channelId]) {
                                    channelMap[channelId] = true
                                    const channelName = await aElement.textContent()
                                    channels.push({
                                        id: channelId,
                                        name: channelName,
                                    })
                                }
                            }
                        }
                    }
                }
                await loadChannels()
                const scrollHeight = await channelScroller.evaluate((element) => {
                    return element.scrollHeight
                })
                const offsetHeight = await channelScroller.evaluate((element) => {
                    return element.offsetHeight
                })
                var scrollPosition = 0
                while (true) {
                    scrollPosition = Math.min((scrollPosition + offsetHeight), scrollHeight)
                    await channelScroller.evaluate((element, scrollPosition) => {
                        element.scrollTo({ top: scrollPosition, behavior: 'smooth' });
                    }, scrollPosition);
                    await page.waitForTimeout(1500);
                    await loadChannels()
                    if (scrollPosition >= scrollHeight) {
                        break
                    }
                }
            })
            return channels
        } catch (error) {
            err = error
        }
    }
    if (err) {
        throw err
    }
    return []
}

export const getDiscordMessagesForChannel = async (page: Page, serverId: string, channelId: string, lastId: string, syncTimeRange: number = SYNC_TIME_RANGE) => {
    var err: any = null
    for (let index = 0; index < 3; index++) {
        try {
            var messages: any[] = []
            await discordMtx.runExclusive(async () => {
                await checkAuthorizedToDiscord(page)
                await page.goto(`https://discord.com/channels/${serverId}/${channelId}`, { waitUntil: 'domcontentloaded' });
                const scrollerSelector = 'div[role="group"][data-jump-section="global"]'
                await page.waitForSelector(scrollerSelector, { timeout: 60 * 1000 });
                const scroller = await page.$(scrollerSelector)
                if (!scroller) {
                    throw new Error('Failed to find scroller')
                }
                await scroller.evaluate((element) => {
                    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
                });
                await page.waitForTimeout(1500);
                var messageMap: any = {}
                const getMessages = async (scroller: ElementHandle) => {
                    const chatMessageElements: ElementHandle[] = await scroller.$$('li')
                    for (const chatMessageElement of chatMessageElements) {
                        if ((await chatMessageElement.getAttribute('class'))?.includes('messageListItem')) {
                            const chatMessageId = await chatMessageElement.getAttribute('id')
                            if (chatMessageId?.includes(`chat-messages-${channelId}`)) {
                                const messageId = chatMessageId.split('-')[3]
                                if (!messageMap[messageId]) {
                                    var authorId = ''
                                    var authorName = ''
                                    var messageContent = ''
                                    var messageTime = ''
                                    var isBot = false
                                    const usernameSpan = await chatMessageElement.$(`#message-username-${messageId}`)
                                    if (usernameSpan) {
                                        authorId = (await usernameSpan.getAttribute('id'))?.split('-')[2] || ''
                                        authorName = (await usernameSpan.textContent()) || ''
                                    }
                                    const messageTimeSpan = await chatMessageElement.$(`#message-timestamp-${messageId}`)
                                    if (messageTimeSpan) {
                                        messageTime = (await messageTimeSpan.getAttribute('datetime')) || ''
                                    }
                                    const messageContentSpan = await chatMessageElement.$(`#message-content-${messageId}`)
                                    if (messageContentSpan) {
                                        messageContent = (await messageContentSpan.textContent()) || ''
                                    }
                                    if (!authorId) {
                                        const eTmp = await chatMessageElement.$('[aria-roledescription="Message"]')
                                        if (eTmp) {
                                            if ((await eTmp.getAttribute('class'))?.includes('isSystemMessage')) {
                                                isBot = true
                                            }
                                        }
                                        if (usernameSpan) {
                                            (await usernameSpan.$$('span'))
                                            const botSpans: ElementHandle[] = await usernameSpan.$$('span')
                                            for (const botSpan of botSpans) {
                                                if ((await botSpan.getAttribute('class'))?.includes('botTagCozy')) {
                                                    isBot = true
                                                    break
                                                }
                                            }
                                        }
                                        if (!isBot) {
                                            authorId = messages.length > 0 ? messages[messages.length - 1].author_id : ''
                                        }
                                    }
                                    if (authorId && !authorName) {
                                        authorName = messages.length > 0 ? messages[messages.length - 1].author : ''
                                    }
                                    authorName = isBot ? 'Bot' : authorName
                                    const replyToElement = await chatMessageElement.$(`#message-reply-context-${messageId}`)
                                    var replyToId = ''
                                    if (replyToElement) {
                                        const replyToIdElements = await replyToElement.$$('div')
                                        for (const replyToIdElement of replyToIdElements) {
                                            const replyToIdElementId = await replyToIdElement.getAttribute('id')
                                            if (replyToIdElementId?.includes('message-content-')) {
                                                replyToId = replyToIdElementId.split('-')[2]
                                                break
                                            }
                                        }
                                    }
                                    messages.push({
                                        id: messageId,
                                        author_id: authorId,
                                        author: authorName,
                                        content: messageContent || '',
                                        timestamp: messageTime || '',
                                        bot: isBot,
                                        reply_to_id: replyToId,
                                    })
                                    messageMap[messageId] = true
                                } else {
                                    break
                                }
                            }
                        }
                    }
                }
                if (scroller) {
                    await getMessages(scroller)
                }
                // sort messages by timestamp
                messages.sort((a, b) => {
                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                })
                if (!messageMap[lastId]) {
                    // check first message if over 30 days old
                    var retryCount = 0
                    for (let i = 0; i < 200; i++) {
                        const lastMessageLength = messages.length
                        if (messages.length > 0) {
                            if (new Date(messages[0].timestamp).getTime() >= Date.now() - syncTimeRange) {
                                await scroller.evaluate((element) => {
                                    element.scrollTo({ top: 0, behavior: 'smooth' });
                                });
                                await page.waitForTimeout(1500);
                                await getMessages(scroller)
                                messages.sort((a, b) => {
                                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                                })
                                if (messageMap[lastId]) {
                                    break
                                }
                                if (messages.length == lastMessageLength) {
                                    retryCount++
                                    if (retryCount >= 3) {
                                        break
                                    }
                                    i--
                                } else {
                                    retryCount = 0
                                }
                                if (messages.length >= 5000) {
                                    break
                                }
                            } else {
                                break
                            }
                        } else {
                            break
                        }
                    }
                }
            })
            return messages
        } catch (error) {
            err = error
        }
    }
    if (err) {
        throw err
    }
    return []
}

export const postMessageToChannel = async (page: Page, serverId: string, channelId: string, message: string) => {
    await discordMtx.runExclusive(async () => {
        await page.goto(`https://discord.com/channels/${serverId}/${channelId}`, { waitUntil: 'domcontentloaded' });
        const chatInputSelector = 'div[role="textbox"][data-slate-node="value"]';
        await page.waitForSelector(chatInputSelector, { state: 'visible', timeout: 60 * 1000 });
        const chatInput: ElementHandle | null = await page.$(chatInputSelector);
        if (!chatInput) {
            throw new Error('Failed to find chat input')
        }
        await chatInput.click();
        const messages = message.split('\n')
        for (let index = 0; index < messages.length; index++) {
            const content = messages[index];
            await page.keyboard.type(content);
            if (index != messages.length - 1) {
                await page.keyboard.press('Shift+Enter');
            }
        }
        await page.keyboard.press('Enter');
    })
}