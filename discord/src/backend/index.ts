import axios, { AxiosResponse } from "axios";
import { extractCustomEnv, getAuthorizationToken, removeBase64Images, removeThinking } from "../utils/helpers";
import { randomUUID } from "crypto";

export const getAgentInfo = async (agent_id: number) => {
    const bearerToken = await getAuthorizationToken();
    const resp = await axios.get(`${process.env.BACKEND_BASE_URL}/vibe-agent/${agent_id}`, {
        headers: {
            'Authorization': `Bearer ${bearerToken}`
        }
    });
    return resp.data;
}

export const startAgent = async (agentId: number, customEnv: string = '') => {
    try {
        const res = await getAgentInfo(agentId);
        if (res === null) {
            throw new Error('Agent not found');
        }
        const bearerToken = await getAuthorizationToken();
        if (res.status === 'none') {
            await axios.put(
                `${process.env.BACKEND_BASE_URL}/vibe-agent/${agentId}/download`,
                {},
                {
                    headers: {
                        "Authorization": `Bearer ${bearerToken}`
                    }
                }
            );
        }
        await axios.post(
            `${process.env.BACKEND_BASE_URL}/vibe-agent/${agentId}/start`,
            {
                user_custom_env: customEnv || '',
                identity_token: process.env.IDENTITY_TOKEN || ''
            },
            {
                headers: {
                    "Authorization": `Bearer ${bearerToken}`
                }
            }
        );
        console.log(`startAgent ${agentId} done`);
    } catch (error) {
        console.log(`startAgent error ${agentId}`, error);
    }
}

export const getRouterPort = async () => {
    return process.env.ROUTER_HOST_PORT;
}

export const hasRouter = () => {
    return process.env.ROUTER_HOST_PORT && process.env.ROUTER_HOST_PORT != '' && process.env.ROUTER_HOST_PORT != '0';
}

export const formatRouter2AgentBaseUrl = async (id: number) => {
    const res: AxiosResponse<{ container_name: string, port: number }> = await axios.get(
        `${process.env.BACKEND_BASE_URL}/vibe-agent/${id}`,
        {
            headers: {
                "Authorization": `Bearer ${await getAuthorizationToken()}`
            }
        }
    );
    if (res.data === null) {
        throw new Error('Agent not found');
    }
    const { container_name, port } = {
        container_name: res.data.container_name,
        port: res.data.port
    };
    if (process.env.DEV_MODE && process.env.DEV_MODE != '') {
        if (hasRouter()) {
            const routerPort = await getRouterPort();
            return `${process.env.BACKEND_BASE_URL}/agent-router/prompt?url=http://localhost:${routerPort}/${container_name}`;
        }
        return `http://${process.env.PODMAN_HOST || 'localhost'}:${port}`;
    }
    if (hasRouter()) {
        return `http://agent_router${(process.env.WALLET && process.env.WALLET != '') ? `_${process.env.WALLET}` : ''}:33030/${container_name}`;
    }
    return `http://${container_name}${port ? `:${port}` : ''}`;
}

export const callAgentWithUrl = async (url: string, bearerToken: string, customEnv: string, messages: any[]): Promise<string> => {
    console.log('\ncallAgentWithUrl', url, 'start ------\n');
    var responseText = '';
    try {
        const env = extractCustomEnv(customEnv)
        const res = await axios.post(
            url,
            {
                id: randomUUID(),
                env: env,
                messages: messages,
                stream: true,
            },
            {
                headers: {
                    "Authorization": `Bearer ${bearerToken}`,
                    "Content-Type": "application/json",
                },
                responseType: 'stream',
            }
        );
        const stream = res.data;
        responseText = await (
            new Promise<string>((resolve, reject) => {
                let resultText = '';
                let tempText = '';
                stream.on('data', (data: any) => {
                    try {
                        let jsonText = data.toString().trim();
                        if (jsonText.startsWith('data: ')) {
                            jsonText = jsonText.slice(5);
                        }
                        if (jsonText === '[DONE]') {
                            process.stdout.write('\n');
                            resolve(resultText);
                        } else {
                            if (jsonText === '') {
                                return;
                            }
                            tempText += jsonText;
                            var json;
                            try {
                                json = JSON.parse(tempText);
                            } catch (error) {
                            }
                            if (json) {
                                if (json.choices && json.choices.length > 0) {
                                    if (json.choices[0].delta.content) {
                                        resultText += json.choices[0].delta.content;
                                        process.stdout.write(json.choices[0].delta.content);
                                    }
                                }
                                tempText = ''
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                stream.on('end', () => {
                    resolve(resultText);
                });
                stream.on('error', (error: any) => {
                    reject(error);
                });
            })
        );
    } catch (error) {
        console.log('\ncallAgentWithUrl', url, 'error ------\n', error);
        return 'Error: ' + error;
    } finally {
        console.log('\ncallAgentWithUrl', url, 'end ------\n');
    }
    return responseText;
}

export const callAgentWithArgs = async (bearerToken: string, args: { agent_id: number, custom_env: string, prompt: string }, { messages }: { messages: any[] }): Promise<string> => {
    console.log(`execute call_agent_${args.agent_id}`, args);
    try {
        const agentBaseUrl = await formatRouter2AgentBaseUrl(args.agent_id);
        let result = await callAgentWithUrl(agentBaseUrl + '/prompt',
            bearerToken,
            args.custom_env,
            [
                ...messages,
                {
                    role: 'user',
                    content: args.prompt
                }
            ]
        );
        result = removeThinking(result);
        result = removeBase64Images(result);
        result = result.trim();
        return result;
    } catch (error) {
        return 'Error: ' + (error instanceof Error ? error.message : 'Unknown error');
    }
}
