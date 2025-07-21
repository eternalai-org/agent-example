import dotenv from 'dotenv';
dotenv.config();
import { sendPrompt } from "./prompt";
import readline from 'readline';

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var messages: any[] = [];

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
            const textStream = await sendPrompt(
                {
                    messages: messages,
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