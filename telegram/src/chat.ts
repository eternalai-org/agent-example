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
function promptUser() {
    rl.question('Enter something (type "exit" to quit): ', async (input: string) => {
        if (input === 'exit') {
            rl.close();
        } else {
            console.log('User said: ', input);
            messages.push({
                role: 'user',
                content: input
            });
            const textStream = await sendPrompt(process.env.IDENTITY_TOKEN as string, {
                env: process.env,
                messages: messages,
                stream: true
            });
            let fullResponse = '';
            process.stdout.write('Assistant said: ');
            if (textStream instanceof ReadableStream) {
                for await (const delta of textStream) {
                    fullResponse += delta;
                    process.stdout.write(delta);
                }
            } else if (typeof textStream === 'string') {
                fullResponse = textStream;
                process.stdout.write(textStream);
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