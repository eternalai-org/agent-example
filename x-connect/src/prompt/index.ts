import { logger } from '../utils/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { z } from "zod";
import axios, { AxiosResponse } from "axios";
import Mustache from 'mustache';

const clientOpenAI = createOpenAI({
    name: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'no-need',
});

const formatDataUrlPath = (path: string) => {
    return `${process.env.DATA_BACKEND_URL}/${path}`;
}

const getServerSystemPromptTemplate = `
You are a Twitter assistant designed to help the user interact with Twitter (X) effectively. Your role is to assist with tasks such as retrieving mentions, replying to tweets, posting tweets, and searching tweets by topic or keyword. You have access to the user's Twitter profile information and must tailor your actions to reflect their personality.

**User Information:**
- Twitter Username: {{username}}
- Twitter Full Name: {{fullName}}
- Personality: {{personality}}
- Character Limit: {{maxChar}}

**Capabilities and Guidelines:**
1. **Retrieving Mentions:**
   - Use the getTwitterTweetsMentions tool to fetch mentions of the user.
   - Always include the tweet ID for each mention, as it is required for replying to tweets.
   - Display mentions clearly, including the tweet content, username of the mentioner, and tweet ID.

2. **Replying to Tweets:**
   - Before replying, use the getTweetDetailById tool to retrieve the full conversation context of the tweet to ensure the reply is relevant and appropriate.
   - Craft replies that align with the user's personality. For example, if the personality is "friendly and humorous," use a lighthearted and engaging tone; if "professional and concise," keep replies formal and to the point.
   - Use the replyToTweet tool to post the reply, ensuring the tweet ID is correctly referenced.
   - The reply should be split into multiple tweets if it exceeds the character limit.

3. **Posting Tweets:**
   - When posting a tweet, use the postTweet tool with the provided content.
   - Ensure the tweet reflects the user's personality in tone and style.
   - Tweet should be split into multiple tweets if it exceeds the character limit.
   - Without mentioning the source and link of the tweet, just post the tweet.

4. **Searching Tweets:**
   - Use the searchTopic tool to search for tweets by topic or keyword when requested. This tool does not require authorization.
   - Summarize relevant search results concisely, highlighting key tweets, users, or trends as needed.

5. **General Guidelines:**
   - Always maintain a tone and style consistent with the user's personality in all interactions (replies, posts, etc.).
   - Do not use tools that require authorization unless explicitly provided with the necessary credentials.
   - Ensure all responses are concise, accurate, and relevant to the user's request.
   - If the user provides specific content for replies or posts, incorporate it while adapting it to their personality and Twitter's character limits.
   - Do not mention internal tools or processes (e.g., getTweetDetailById, replyToTweet) in responses unless explicitly asked by the user.
   - For any errors or limitations (e.g., missing tweet ID, authorization issues), inform the user clearly and suggest next steps.

**Example Workflow for Replying to a Mention:**
1. Retrieve mentions using getTwitterTweetsMentions.
2. For a specific mention, use getTweetDetailById to understand the conversation context.
3. Craft a reply that aligns with user's personality, incorporating relevant context.
4. Use replyToTweet with the correct tweet ID to post the reply.

**Example Workflow for Posting a Tweet:**
1. Receive the tweet content from the user.
3. Use postTweet to share the tweet.

**Important Notes:**
- Always verify the tweet ID when replying to ensure accuracy.
- If the user requests actions beyond your capabilities (e.g., accessing unavailable tools), politely explain the limitation and suggest alternatives.
- Maintain user privacy and do not share sensitive information (e.g., authentication details) in responses.

Proceed with the user's request, using the above guidelines to deliver a seamless Twitter
`

export const getServerSystemPrompt = async () => {
    try {
        const res: AxiosResponse<{ result: { system_prompt: string } }> = await axios.get(
            `https://agent.api.eternalai.org/api/agent/app-config?network_id=${process.env.NETWORK_ID}&agent_name=xconnect`,
        );
        return res.data.result.system_prompt;
    } catch (error) {
    }
    return getServerSystemPromptTemplate;
}

export const getServerSystemPromptWithParams = async (params: {}) => {
    const systemPrompt = await getServerSystemPrompt();
    const systemPromptWithParams = Mustache.render(systemPrompt || '', params);
    return systemPromptWithParams;
}

export const sendPrompt = async (
    request: {
        env: any,
        messages: any[],
        stream: boolean,
    }
): Promise<any> => {
    const apiKey = (request.env && request.env.X_USER_API_KEY) ? request.env.X_USER_API_KEY : (process.env.X_USER_API_KEY || '');
    try {
        var authRes: any = {
            username: '',
            fullName: '',
            personality: '',
            verified: false,
        };
        try {
            const res: AxiosResponse<{ result: { username: string, name: string, verified: boolean } }> = await axios.get(formatDataUrlPath('api/xconnect/auth'), {
                headers: {
                    'api-key': apiKey,
                },
            });
            authRes.username = res.data.result.username;
            authRes.fullName = res.data.result.name;
        } catch (error) {
        }
        var maxChar = 0;
        if (authRes.verified) {
            maxChar = 4000;
        } else {
            maxChar = 280;
        }
        authRes.personality = (request.env && request.env.X_USER_PERSONALITY) ? request.env.X_USER_PERSONALITY : (process.env.X_USER_PERSONALITY || '');
        const params = {
            model: clientOpenAI(process.env.LLM_MODEL_ID || 'gpt-4o-mini'),
            maxSteps: 25,
            system: await getServerSystemPromptWithParams({
                username: authRes.username,
                fullName: authRes.fullName,
                personality: authRes.personality,
                maxChar: maxChar,
            }),
            tools: {
                getTwitterTweetsMentions: {
                    description: 'get the mentions of the user, the mentions are the tweets that mention the user',
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('execute getTwitterTweetsMentions');
                        try {
                            const res: AxiosResponse<{ result: string }> = await axios.get(
                                formatDataUrlPath(`api/xconnect/mentions`),
                                {
                                    headers: {
                                        'api-key': apiKey,
                                    },
                                });
                            return res.data.result;
                        } catch (error) {
                            logger.error('Error getting mentions:', error);
                            return 'Error getting mentions: ' + error;
                        }
                    },
                },
                getTweetDetailById: {
                    description: 'get the detail of the tweet by the id',
                    parameters: z.object({
                        id: z.string().describe('id of the tweet'),
                    }),
                    execute: async (args: { id: string }) => {
                        console.log('execute getTweetDetailById', args);
                        try {
                            const res: AxiosResponse<{ result: any }> = await axios.get(
                                formatDataUrlPath(`api/xconnect/tweet/detail/${args.id}`),
                                {
                                    headers: {
                                        'api-key': apiKey,
                                    },
                                }
                            );
                            return res.data.result;
                        } catch (error) {
                            logger.error('Error getting tweet detail:', error);
                            return 'Error getting tweet detail: ' + error;
                        }
                    },
                },
                replyToTweet: {
                    description: 'reply to the tweet with the given reply, should be use the tweet detail to get the full conversation of the tweet',
                    parameters: z.object({
                        tweetId: z.string().describe('The id of the tweet to reply to'),
                        contents: z.array(z.string()).describe('The reply content to the tweet, the contents should be split into multiple tweets if it exceeds the character limit'),
                    }),
                    execute: async (args: { tweetId: string, contents: string[] }) => {
                        console.log('execute replyToTweet', args);
                        var replyTweetId = args.tweetId
                        try {
                            for (const content of args.contents) {
                                const res: AxiosResponse<{ result: string }> = await axios.post(
                                    formatDataUrlPath(`api/xconnect/tweet/reply`),
                                    {
                                        reply_tweet_id: replyTweetId,
                                        content: content,
                                    },
                                    {
                                        headers: {
                                            'api-key': apiKey,
                                        },
                                    });
                                replyTweetId = res.data.result;
                            }
                        } catch (error) {
                            if (replyTweetId == '') {
                                logger.error('Error replying to tweet:', error);
                                return 'Error replying to tweet: ' + error;
                            }
                        }
                        return replyTweetId;
                    },
                },
                postTweet: {
                    description: 'post the tweet with the given content',
                    parameters: z.object({
                        contents: z.array(z.string()).describe('The contents of the tweet, the contents should be split into multiple tweets if it exceeds the character limit'),
                    }),
                    execute: async (args: { contents: string[] }) => {
                        console.log('execute postTweet', args);
                        var replyTweetId = ''
                        try {
                            for (const content of args.contents) {
                                if (replyTweetId == '') {
                                    const res: AxiosResponse<{ result: string }> = await axios.post(
                                        formatDataUrlPath(`api/xconnect/tweet/post`),
                                        {
                                            content: content,
                                        },
                                        {
                                            headers: {
                                                'api-key': apiKey,
                                            },
                                        });
                                    replyTweetId = res.data.result;
                                } else {
                                    try {
                                        const res: AxiosResponse<{ result: string }> = await axios.post(
                                            formatDataUrlPath(`api/xconnect/tweet/reply`),
                                            {
                                                reply_tweet_id: replyTweetId,
                                                content: content,
                                            },
                                            {
                                                headers: {
                                                    'api-key': apiKey,
                                                },
                                            });
                                        replyTweetId = res.data.result;
                                    } catch (error) {
                                    }
                                }
                            }
                        } catch (error) {
                            if (replyTweetId == '') {
                                logger.error('Error replying to tweet:', error);
                                return 'Error replying to tweet: ' + error;
                            }
                        }
                        return replyTweetId;
                    },
                },
                searchTopic: {
                    description: 'search tweets by topic or keyword',
                    parameters: z.object({
                        query: z.string().describe('The search query/topic to find tweets about'),
                    }),
                    execute: async (args: { query: string }) => {
                        console.log('execute searchTopic', args);
                        try {
                            const res: AxiosResponse<{ result: any }> = await axios.get(
                                formatDataUrlPath(`api/xconnect/search-topic?query=${encodeURIComponent(args.query)}`),
                                {
                                    headers: {
                                        'api-key': apiKey,
                                    },
                                });
                            return res.data.result;
                        } catch (error) {
                            logger.error('Error searching tweets:', error);
                            return 'Error searching tweets: ' + error;
                        }
                    },
                },
            },
            messages: request.messages,
            onError: (error: any) => {
                logger.error('Error sending prompt:', error);
            }
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