import dotenv from 'dotenv';
dotenv.config();
import { sendPromptWithMultipleAgents } from "./prompt";
import readline from 'readline';

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var messages: any[] = [];

const agents = [
    {
        id: 15605,
        name: 'News',
        description: 'get news',
        custom_env: ''
    },
    {
        id: 15292,
        name: 'Hacker News',
        description: 'get news from hacker news',
        custom_env: ''
    },
    {
        id: 15264,
        name: 'Telegram',
        description: 'post message to telegram',
        custom_env: process.env.APP_ENV_15264 || ''
    },
]

// Function to prompt user in a loop
async function promptUser() {
    rl.question('Enter something (type "exit" to quit): ', async (input: string) => {
        if (input === 'exit') {
            rl.close();
        } else {
            console.log('User said: ', input);
            messages.push({
                role: 'user',
                content: input
            });
            const callAgentFunc = async (delta: string) => {
                process.stdout.write(delta);
            }
            const textStream = await sendPromptWithMultipleAgents(
                {
                    messages: messages,
                    agents
                },
                callAgentFunc,
            );
            let fullResponse = '';
            process.stdout.write('Assistant said: ');
            for await (const delta of textStream) {
                fullResponse += delta;
                process.stdout.write(delta);
            }
            process.stdout.write('\n\n');
            messages.push({
                role: 'assistant',
                content: fullResponse
            });
            promptUser();
        }
    });
}

promptUser();