export const SYNC_TIME_RANGE = 3 * 24 * 60 * 60 * 1000

export interface MessageData {
    channel_id: bigint;
    channel: string;
    id: bigint;
    author: string;
    author_id: string;
    content: string;
    timestamp: Date;
    reply_to: MessageData | null;
}