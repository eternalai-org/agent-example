# Telegram Helper Bot

A Node.js application that provides an AI assistant integrated with Telegram using the Telegram Bot API.

## Features

- **Direct Telegram Bot API Integration**: Uses Telegram Bot API directly with bot token
- **AI-Powered Messaging**: Intelligent message generation and posting to Telegram channels/groups
- **Dynamic Configuration**: Update channel ID and test bot connection in real-time
- **Markdown Support**: Send formatted messages with Telegram markdown support

## Setup

### 1. Environment Configuration

Create a `.env` file with the following variables:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=your_channel_id_here

# LLM Configuration
LLM_BASE_URL=https://vibe-agent-gateway.eternalai.org/v1
LLM_API_KEY=your_llm_api_key
LLM_MODEL_ID=gpt-4o-mini

# Server Configuration
PORT=3000
DATA_BACKEND_URL=http://localhost:8480
```

### 2. Getting Your Bot Token

1. Create a new bot with [@BotFather](https://t.me/botfather) on Telegram
2. Get your bot token from BotFather
3. Add the token to your `.env` file

### 3. Getting Your Channel/Group ID

#### Method 1: Using @userinfobot
1. Search for `@userinfobot` on Telegram
2. Start a chat with it
3. Add it to your group or channel
4. Send a message in the group/channel
5. Go back to @userinfobot - it will show your Chat ID

#### Method 2: Using Your Bot
1. Add your bot to your group or channel
2. Grant it "Send Messages" permission
3. Send any message in the group/channel
4. Check your bot's webhook or logs for the chat ID

### 4. Bot Permissions

Make sure your bot has the following permissions in your channel/group:
- Send Messages
- Read Messages (if needed)

## Usage

### Starting the Server

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start

# Or run in development mode
npm run dev
```

### Testing the Bot

```bash
# Test the Telegram bot connection and send a test message
npm run test-telegram
```

### Interactive Chat

```bash
# Start an interactive chat session
npm run chat
```

## API Endpoints

### POST /prompt

Send a prompt to the AI assistant and get a response.

**Headers:**
```
Authorization: Bearer your_token_here
Content-Type: application/json
```

**Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Send a message to the channel"
    }
  ],
  "stream": false
}
```

## Available Tools

The AI assistant has access to the following tools:

### getBotInfo
Test the bot connection and get bot information.

### getBotToken
Get the current bot token configuration.

### getChannelID
Get the current channel ID configuration.

### updateChannelID
Update the channel ID dynamically.

**Parameters:**
- `channel_id` (string): The new channel ID to set

### postMessage
Send a message to the configured Telegram channel.

**Parameters:**
- `message` (string): The content of the message to send

## Message Formatting

The bot supports Telegram markdown formatting:

- **Bold**: `**text**` or `__text__`
- *Italic*: `*text*` or `_text_`
- `Code`: \`code\`
- [Links](url): `[text](url)`

## Error Handling

The bot includes comprehensive error handling for:
- Missing bot token or channel ID
- Invalid bot token
- Network connectivity issues
- Telegram API errors
- Permission issues

## Development

### Project Structure

```
src/
├── prompt/
│   └── index.ts          # Main prompt handling logic
├── server.ts             # Express server setup
├── chat.ts               # Interactive chat interface
├── types/
│   └── chat.ts           # TypeScript type definitions
└── utils/
    └── logger.ts         # Logging utility
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Docker

Build and run with Docker:

```bash
# Build the image
npm run build-docker

# Run the container
docker run -p 3000:80 --env-file .env telegram-helper
```

## Troubleshooting

### Common Issues

1. **Bot not sending messages**: Check if the bot has "Send Messages" permission in the channel
2. **Invalid channel ID**: Make sure the channel ID is correct and the bot is added to the channel
3. **Bot token error**: Verify the bot token is correct and the bot is active
4. **Network issues**: Check your internet connection and firewall settings

### Testing

Use the test script to verify your setup:

```bash
npm run test-telegram
```

This will:
1. Test the bot connection
2. Get bot information
3. Send a test message to your channel

## License

This project is part of the Vibe Examples collection. 