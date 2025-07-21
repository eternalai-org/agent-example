export const removeThinking = (text: string) => {
    var rs = text.replace(/<think>.*?<\/think>/gis, '');
    rs = rs.replace(/<action>.*?<\/action>/gis, '');
    rs = rs.replace(/<summary>.*?<\/summary>/gis, '');
    rs = rs.replace(/<details>.*?<\/details>/gis, '');
    return rs
}

export const removeBase64Images = (htmlString: string) => {
    return htmlString.replace(/<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi, '');
}

export function convertDateToSnowflakeID(date: Date): string {
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

export function convertSnowflakeIDToDate(snowflake: string): Date {
    // Discord epoch (January 1, 2015 00:00:00 UTC)
    const DISCORD_EPOCH = 1420070400000;
    // Convert snowflake string to bigint and extract timestamp
    const timestamp = (BigInt(snowflake) >> 22n) + BigInt(DISCORD_EPOCH);
    // Convert to Date object
    return new Date(Number(timestamp));
}
