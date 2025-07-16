import { logger } from '../utils/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { z } from "zod";
import axios, { AxiosResponse } from "axios";

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

const formatDataUrlPath = (path: string) => {
    return `${process.env.DATA_BACKEND_URL}/${path}`;
}

const defaultSystemPrompt = `
You are a helpful assistant that can help users get the latest news from the Twitter API.

Important:
- Only get tweets/news related to crypto, blockchain, web3, AI, and technology
- Base selection on engagement score to get highlight news
- Remove duplicate news, keep the one with the highest engagement score
- Response must include the original full tweet content
- Get top 10 highlight news and respond in the format as shown below, ordered by posted_at ascending:
- Format:
tweet content
Source : https://x.com/username/status/tweet_id 
Sample format:
This Bitcoin OG with 80,009 $BTC($9.46B) transferred another 7,843 $BTC($927M) to #GalaxyDigital, for a total of 16,843 $BTC ($2B). Galaxy Digital is depositing $BTC to exchanges, and 2,000 $BTC($236M) has been directly deposited to #Bybit and #Binance. https://t.co/Sm9UBYboIN https://t.co/rwxHtrV0DQ  
Source: https://x.com/1462727797135216641/status/1944959737742946600

Requirements:
- Only include tweets with engagement score > 1000
- Filter out spam, bot accounts, and low-quality content
- Ensure all links are valid and accessible
- Sort by posted_at timestamp in ascending order (oldest first)
- Provide accurate tweet URLs in the format: https://x.com/username/status/tweet_id
`

export const getServerSystemPrompt = async () => {
    try {
        const res: AxiosResponse<{ result: { system_prompt: string } }> = await axios.get(
            `https://agent.api.eternalai.org/api/agent/app-config?network_id=${process.env.NETWORK_ID}&agent_name=news`,
        );
        return res.data.result.system_prompt;
    } catch (error) {
        return defaultSystemPrompt
    }
}

export const sendPrompt = async (request: { messages: any[], stream: boolean }): Promise<any> => {
    try {
        const params = {
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: await getServerSystemPrompt(),
            tools: {
                getNews: {
                    description: `fetch the latest news from the news API`,
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('execute getNews');
                        try {
                            const res: AxiosResponse<{ result: any[] }> = await axios.get(formatDataUrlPath('api/news/tweet'));
                            return res.data.result;
                        } catch (error) {
                            logger.error('Error getting news:', error);
                            return 'Error getting news: ' + error;
                        }
                    },
                },
            },
            messages: request.messages,
        }
        if (request.stream) {
            const { textStream } = streamText(params);
            return textStream;
        } else {
            const { text } = await generateText(params);
            return text;
        }
    } catch (error) {
        logger.error('Error sending prompt:', error);
        throw new Error('Failed to send prompt');
    }
}