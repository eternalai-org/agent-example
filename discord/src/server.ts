import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import cors from 'cors';
import { sendPrompt } from "./prompt";
import { jobSyncDiscordMessagesAndSummarize, newChromiumPage } from './services';
import { syncDB } from './services/database';
import { Page } from 'playwright';

const app = express();
const port = process.env.PORT || 80;

var page: Page | null = null

// app use cors all origin
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Credentials'],
}));

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/processing-url', (req: any, res: any) => {
    const returnUrl = new URL(process.env.HTTP_DISPLAY_URL || "http://localhost:6080/vnc.html?autoconnect=true&resize=scale&reconnect_delay=1000&reconnect=1");
    res.json({
        url: returnUrl,
        status: "ready",
    });
});

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
        const textStream = await sendPrompt(page, req.body, callAgentFunc);
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
    // sync db
    await syncDB()
    // init page
    page = await newChromiumPage();
    // start job
    (async () => {
        await jobSyncDiscordMessagesAndSummarize()
    })();
    // start server on port
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
})()
