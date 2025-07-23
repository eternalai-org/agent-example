import { ElementHandle, Page } from "playwright";
import { SYNC_TIME_RANGE } from "../types";

export const gotoLoginPageAndWait = async (page: Page) => {
    try {
        await page.goto('https://discord.com/login', { waitUntil: 'networkidle' });
    } catch (error) {
        throw new Error('Failed to login to Discord');
    }
}

export const checkDiscordAuthorized = async (page: Page) => {
    try {
        await page.goto('https://discord.com/login', { waitUntil: 'networkidle' });
        await page.waitForSelector('rect[mask="url(#svg-mask-status-online)"]', { timeout: 5 * 60 * 60 * 1000 });
    } catch (error) {
        throw new Error('Not authorized to Discord');
    }
}

export const getAllServers = async (page: Page) => {
    await page.goto('https://discord.com/channels/@me', { waitUntil: 'networkidle' });
    const divAlls: ElementHandle[] = await page.$$('div')
    const servers: any[] = []
    for (const div of divAlls) {
        if ((await div.getAttribute('class'))?.includes('stack')
            && (await div.getAttribute('role')) === 'group') {
            const divBlobContainers = await div.$$('div')
            for (const divBlobContainer of divBlobContainers) {
                if ((await divBlobContainer.getAttribute('class'))?.includes('blobContainer')) {
                    const foreignObjects: ElementHandle[] = await divBlobContainer.$$('foreignObject')
                    for (const foreignObject of foreignObjects) {
                        const divWrappers: ElementHandle[] = await foreignObject.$$('div')
                        for (const divWrapper of divWrappers) {
                            if ((await divWrapper.getAttribute('class'))?.includes('wrapper__')
                                && (await divWrapper.getAttribute('role')) === 'treeitem') {
                                const dataListItemId = await divWrapper.getAttribute('data-list-item-id')
                                if (dataListItemId != '') {
                                    const serverId = (await divWrapper.getAttribute('data-list-item-id'))?.split('___')[1]
                                    const serverName = await divBlobContainer.getAttribute('data-dnd-name')
                                    const images = await divWrapper.$$('img')
                                    var imageSrc = ''
                                    for (const image of images) {
                                        imageSrc = await image.getAttribute('src') || ''
                                        if (imageSrc != '') {
                                            break
                                        }
                                    }
                                    servers.push({
                                        id: serverId,
                                        name: serverName,
                                        image_src: imageSrc
                                    })
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return servers
}

export const getDiscordChannels = async (page: Page, serverId: string) => {
    await checkDiscordAuthorized(page)
    await page.goto(`https://discord.com/channels/${serverId}`);
    await page.waitForSelector('#channels', { timeout: 30 * 1000 });
    const channelScroller: ElementHandle = (await page.$$('#channels'))[0]
    await channelScroller.evaluate((element) => {
        element.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
    const channels: any[] = []
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
        await page.waitForTimeout(1000);
        await loadChannels()
        if (scrollPosition >= scrollHeight) {
            break
        }
    }
    return channels
}

export const getDiscordMessagesForChannel = async (page: Page, serverId: string, channelId: string, lastId: string, syncTimeRange: number = SYNC_TIME_RANGE) => {
    await checkDiscordAuthorized(page)
    await page.goto(`https://discord.com/channels/${serverId}/${channelId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main', { timeout: 3 * 1000 });
    const mains: ElementHandle[] = await page.$$('main')
    var scroller: ElementHandle | null = null
    var messagesWrapper: ElementHandle | null = null
    for (const main of mains) {
        if ((await main.getAttribute('class'))?.includes('chatContent')) {
            const messagesWrapperDivs: ElementHandle[] = await main.$$('div')
            for (const messagesWrapperDiv of messagesWrapperDivs) {
                if (!scroller
                    && (await messagesWrapperDiv.getAttribute('class'))?.includes('scroller')
                    && (await messagesWrapperDiv.getAttribute('role')) == 'group'
                    && (await messagesWrapperDiv.getAttribute('data-jump-section')) == 'global') {
                    scroller = messagesWrapperDiv
                }
                if (!messagesWrapper
                    && (await messagesWrapperDiv.getAttribute('class'))?.includes('messagesWrapper')) {
                    messagesWrapper = messagesWrapperDiv
                }
                if (scroller && messagesWrapper) {
                    break
                }
            }
        }
    }
    if (!scroller || !messagesWrapper) {
        throw new Error('Failed to find scroller or messagesWrapper')
    }
    await scroller.evaluate((element) => {
        element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
    var messages: any[] = []
    var messageMap: any = {}
    const getMessages = async (messagesWrapper: ElementHandle) => {
        const chatMessageElements: ElementHandle[] = await messagesWrapper.$$('li')
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
                        const usernameSpan = (await chatMessageElement.$$(`#message-username-${messageId}`))
                        if (usernameSpan.length > 0) {
                            authorId = (await usernameSpan[0].getAttribute('id'))?.split('-')[2] || ''
                            authorName = (await usernameSpan[0].textContent()) || ''
                        }
                        const messageTimeSpan = (await chatMessageElement.$$(`#message-timestamp-${messageId}`))
                        if (messageTimeSpan.length > 0) {
                            messageTime = (await messageTimeSpan[0].getAttribute('datetime')) || ''
                        }
                        const messageContentSpan = (await chatMessageElement.$$(`#message-content-${messageId}`))
                        if (messageContentSpan.length > 0) {
                            messageContent = (await messageContentSpan[0].textContent()) || ''
                        }
                        if (!authorId) {
                            authorId = messages[messages.length - 1].author_id || ''
                            authorName = messages[messages.length - 1].author_name || ''
                        }
                        messages.push({
                            id: messageId,
                            author_id: authorId,
                            author: authorName,
                            content: messageContent || '',
                            timestamp: messageTime || '',
                        })
                        messageMap[messageId] = true
                    } else {
                        break
                    }
                }
            }
        }
    }
    if (messagesWrapper) {
        await getMessages(messagesWrapper)
    }
    // sort messages by timestamp
    messages.sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    })
    if (!messageMap[lastId]) {
        // check first message if over 30 days old
        for (let i = 0; i < 100; i++) {
            if (messages.length > 0) {
                if (new Date(messages[0].timestamp).getTime() >= Date.now() - syncTimeRange) {
                    await scroller.evaluate((element) => {
                        element.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                    await page.waitForTimeout(1000);
                    await getMessages(messagesWrapper)
                    messages.sort((a, b) => {
                        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    })
                } else {
                    break
                }
            } else {
                break
            }
            if (messages.length % 50 != 0) {
                break
            }
            if (messageMap[lastId]) {
                break
            }
        }
    }
    return messages
}