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

export const getServerSystemPrompt = async () => {
    const res: AxiosResponse<{ result: { system_prompt: string } }> = await axios.get(
        `https://agent.api.eternalai.org/api/agent/app-config?network_id=${process.env.NETWORK_ID}&agent_name=news`,
    );
    return res.data.result.system_prompt;
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