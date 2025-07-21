import { ChannelType, Client, GatewayIntentBits } from 'discord.js';

export const getServerChanels = async (botToken: string, serverId: string) => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(botToken);
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
        throw new Error(`Guild ${serverId} not found`);
    }
    return (await guild.channels.fetch()).filter(channel => channel?.type === ChannelType.GuildText);
}

export const getRecentMessages = async (botToken: string, serverId: string, channelId: string) => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(botToken);
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
        throw new Error(`Guild ${serverId} not found`);
    }
    const channel: any = await guild.channels.fetch(channelId);
    if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
    }
    const messages: any[] = await channel.messages.fetch({ limit: 100 });
    messages.reverse()
    return messages.map((message: any) => ({
        id: message.id,
        content: message.content,
        author: message.author.username,
        timestamp: message.createdAt,
    }));
}

// export const getServerMemberCount = async (botToken: string, serverId: string) => {
//     const client = new Client({ intents: [GatewayIntentBits.Guilds] });
//     await client.login(botToken);
//     const guild = await client.guilds.fetch(serverId);
//     if (!guild) {
//         throw new Error(`Guild ${serverId} not found`);
//     }
//     await guild.members.fetch();
//     return guild.memberCount;
// }

// export const getServerActiveMembers = async (botToken: string, serverId: string) => {
//     const client = new Client({ intents: [GatewayIntentBits.Guilds] });
//     await client.login(botToken);
//     const guild = client.guilds.cache.get(serverId);
//     if (!guild) {
//         throw new Error(`Guild ${serverId} not found`);
//     }
//     const members = await guild.members.fetch({ withPresences: true });
//     return members.map(member => ({
//         id: member.id,
//         username: member.user.username,
//         avatar: member.user.avatarURL(),
//         status: member.presence?.status,
//     }));
// }