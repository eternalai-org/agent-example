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