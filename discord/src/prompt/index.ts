import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from "zod";
import { getAuthorizationToken, getServerSystemPrompt } from "../utils/helpers";

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

// export const startAgents = async (agents: { id: number, name: string, description: string, custom_env: string }[]): Promise<any> => {
//     for (const agent of agents) {
//         await startAgent(agent.id, agent?.custom_env || '');
//     }
// }

export const sendPromptWithMultipleAgents = async (
    request: { messages: any[], agents: { id: number, name: string, description: string, custom_env: string }[] },
    callAgentFunc: (delta: string) => Promise<void>
): Promise<any> => {
    try {
        const bearerToken = await getAuthorizationToken();
        const agents = request.agents || [
            {
                id: 15605,
                name: 'News',
                description: 'get news in 24 hours',
                custom_env: ''
            },
            {
                id: 15292,
                name: 'Hacker News',
                description: 'get news from hacker news',
                custom_env: ''
            },
            // {
            //     id: 15204,
            //     name: 'Deep Search',
            //     description: 'search the web for information',
            //     custom_env: ''
            // },
            {
                id: 15264,
                name: 'Telegram',
                description: 'post message to telegram',
                custom_env: process.env.APP_ENV_15264 || ''
            },
            {
                id: 15249,
                name: 'XConnect',
                description: 'post message to twitter',
                custom_env: process.env.APP_ENV_15249 || ''
            }
        ]
        const tools: any = {}
        tools['list_agents'] = {
            description: 'list the agents with id, name and description',
            parameters: z.object({}),
            execute: async () => {
                return agents.map((agent) => ({
                    id: agent.id,
                    name: agent.name,
                    description: agent.description,
                }));
            },
        }
        const { textStream } = streamText({
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: await getServerSystemPrompt(),
            tools: tools,
            messages: request.messages,
            onError: (error) => {
                console.log('sendPromptWithMultipleAgents onError', error);
            },
        });
        return textStream;
    } catch (error) {
        throw new Error('Failed to send prompt');
    }
}