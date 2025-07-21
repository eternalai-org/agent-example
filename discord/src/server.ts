import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import cors from 'cors';
import { sendPrompt } from "./prompt";
import { jobSyncDiscordMessagesAndSummarize } from './services';

const app = express();
const port = process.env.PORT || 80;

// app use cors all origin
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Credentials'],
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Route for handling prompts
app.post('/prompt', async (req: any, res: any) => {
    var pingTimeout: any = null
    try {
        const writeDelta = (delta: string) => {
            if (pingTimeout) {
                clearTimeout(pingTimeout)
            }
            const message = {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: delta,
                        },
                    },
                ],
            }
            res.write(`data: ${JSON.stringify(message)}\n\n`);
            process.stdout.write(delta);
            pingTimeout = setTimeout(pingFunc, 1000);
        }
        const callAgentFunc = async (delta: string) => {
            writeDelta(delta)
        }
        const textStream = await sendPrompt(req.body, callAgentFunc);
        const pingFunc = async () => {
            const message = {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: '',
                        },
                    },
                ],
            }
            res.write(`data: ${JSON.stringify(message)}\n\n`);
            pingTimeout = setTimeout(pingFunc, 1000);
        }
        pingTimeout = setTimeout(pingFunc, 1000);
        for await (const delta of textStream) {
            writeDelta(delta)
        }
        clearTimeout(pingTimeout)
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (error) {
        if (pingTimeout) {
            clearTimeout(pingTimeout)
        }
        const message = {
            choices: [
                {
                    delta: {
                        role: 'assistant',
                        content: 'Something went wrong. Please try again.',
                    },
                },
            ],
        }
        res.write(`data: ${JSON.stringify(message)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
    }
});

// Start the server
(async () => {
    // start the job to sync discord messages and summarize
    jobSyncDiscordMessagesAndSummarize()
    // start server on port
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
})()
