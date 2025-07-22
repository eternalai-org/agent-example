export interface MessageData {
    channel_id: bigint;
    channel: string;
    id: bigint;
    author: string;
    author_id: string;
    content: string;
    timestamp: Date;
}