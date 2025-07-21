import axios, { AxiosResponse } from 'axios';

export const formatDataUrlPath = (path: string) => {
    return `${process.env.DATA_BACKEND_URL}/${path}`;
}

export const formatBackendUrlPath = (path: string) => {
    return `${process.env.BACKEND_BASE_URL}/${path}`;
}

export const getAuthorizationToken = async () => {
    return process.env.AUTHORIZATION_TOKEN || '1';
}

export const extractCustomEnv = (customEnv: string) => {
    if (!customEnv || customEnv == '') {
        return {};
    }
    const lines = customEnv.split('\n');
    const env: any = {}
    for (var line of lines) {
        try {
            line = line.trim()
            if (line !== '') {
                const index = line.indexOf('=');
                if (index !== -1) {
                    const key = line.slice(0, index).trim();
                    const value = line.slice(index + 1).trim();
                    env[key] = value;
                }
            }
        } catch (error) {
        }
    }
    return env;
}

export const extractBearerToken = (bearerToken: string) => {
    if (!bearerToken) {
        return '';
    }
    if (bearerToken.startsWith('bearer ')) {
        bearerToken = bearerToken.slice(7);
    }
    if (bearerToken.startsWith('Bearer ')) {
        bearerToken = bearerToken.slice(7);
    }
    return bearerToken.trim()
}

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


const SYSTEM_PROMPT_WITH_MULTIPLE_AGENTS = `
You are an orchestrator assistant responsible for managing a workflow of multiple AI agents. Your tasks are to:  
1. Analyze the user's request and determine the optimal sequence of agent calls.  
2. Invoke each agent using the call_agent_$id tool with precise, contextual prompts.  
3. Pass outputs between agents as needed, preserving each agent's original response as much as possible before forwarding it to the next step.  
4. Ensure seamless coordination to achieve the user's goal efficiently.  
5. Deliver a final response that integrates all agent contributions cohesively.  

Guidelines:  
- Always use call_agent_$id tools to interact with agents.  
- Include relevant context and prior outputs in each prompt while minimizing unnecessary alterations to agent responses.  
- Maintain a natural conversational flow and avoid exposing internal orchestration mechanics.  
- Provide each agent with enough context to perform their task effectively without over-editing their outputs.  
`

export const getServerSystemPrompt = async () => {
    try {
        const res: AxiosResponse<{ result: { system_prompt: string } }> = await axios.get(
            `https://agent.api.eternalai.org/api/agent/app-config?network_id=${process.env.NETWORK_ID}&agent_name=supervisor`,
        );
        return res.data.result.system_prompt;
    } catch (error) {
    }
    return SYSTEM_PROMPT_WITH_MULTIPLE_AGENTS
}