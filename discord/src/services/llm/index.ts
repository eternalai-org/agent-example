import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { removeThinking } from "../helpers";

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

export const chatMessageWithLLM = async (system: string, message: string): Promise<string> => {
    system = system.trim()
    message = message.trim()
    const { text } = await generateText({
        model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
        maxSteps: 25,
        system: system,
        messages: [
            {
                role: 'user',
                content: message,
            }
        ]
    })
    var rs = removeThinking(text)
    return rs
}