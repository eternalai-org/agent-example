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

export const sendPrompt = async (request: { messages: any[], stream: boolean }): Promise<any> => {
    try {
        const params = {
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: `
            You are a helpful assistant that can help the user to get the latest news from the news API.

            Important:
            - just get news relate to crypto, blockchain, web3, ai
            - calculate engagement score =view count + 3 * like count + 2* reply count + 4* retweet count
            - base on engagement  score  to get higlight news
            - reponse should be full content of the news include link
            - get top 10 higlight news and reponse by format as sample ordered by posted at ascending:
             + "Do you have any more bold predictions, Peter? https://t.co/hFdONVb4E0"
             Link: https://x.com/grok_ai/status/1940876167755845865
          
             
           
        `,
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