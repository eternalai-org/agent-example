import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { sendPrompt } from './prompt';

const app = express();
const port = process.env.PORT || 80;

// Middleware to parse JSON bodies
app.use(express.json());

// Route for handling prompts
app.post('/prompt', async (req: any, res: any) => {
    try {
        const textStream = await sendPrompt(req.body);
        if (textStream instanceof ReadableStream) {
            process.stdout.write('Assistant said: ');
            for await (const delta of textStream) {
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
                process.stdout.write(delta);
                res.write(`data: ${JSON.stringify(message)}\n\n`);
            }
            res.write("data: [DONE]\n\n");
            res.end();
        } else if (typeof textStream === 'string') {
            const message = {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: textStream,
                        },
                    },
                ],
            }
            res.status(200).json(message);
        }
    } catch (error) {
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
        if (req.body.stream) {
            res.write(`data: ${JSON.stringify(message)}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
        } else {
            res.status(200).json(message);
        }
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
