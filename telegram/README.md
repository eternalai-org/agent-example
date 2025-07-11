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
```

### 2. Getting Your Bot Token

#### Step-by-Step Guide:

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather by clicking "Start"
3. **Create a new bot** by sending the command: `/newbot`
4. **Choose a name** for your bot (e.g., "My Helper Bot")
5. **Choose a username** for your bot (must end with 'bot', e.g., "my_helper_bot")
6. **Copy the bot token** that BotFather sends you - it looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
7. **Add the token** to your `.env` file as `TELEGRAM_BOT_TOKEN`

**Important Notes:**
- Keep your bot token secret and never share it publicly
- If you lose your token, you can get a new one by sending `/mybots` to BotFather, selecting your bot, and choosing "API Token"
- The token format is: `bot_id:bot_token`

### 3. Getting Your Channel/Group ID

#### Method 1: Using @userinfobot (Recommended)

1. **Search for `@userinfobot`** on Telegram
2. **Start a chat** with @userinfobot by clicking "Start"
3. **Add @userinfobot to your group/channel**:
   - For groups: Go to group settings → Add members → Search "@userinfobot"
   - For channels: Go to channel settings → Administrators → Add admin → Search "@userinfobot"
4. **Send any message** in your group/channel
5. **Go back to @userinfobot** - it will show you the Chat ID
6. **Copy the Chat ID** (it will be a number like `-1001234567890` for channels or `-123456789` for groups)

#### Method 2: Using Your Bot (Alternative)

1. **Add your bot to your group/channel**:
   - For groups: Go to group settings → Add members → Search your bot's username
   - For channels: Go to channel settings → Administrators → Add admin → Search your bot's username
2. **Grant necessary permissions** to your bot:
   - Send Messages
   - Read Messages (if needed)
3. **Send any message** in your group/channel
4. **Check your bot's logs** or use the Telegram API to get the chat ID

#### Method 3: Using Telegram Web (For Personal Chats)

1. **Open Telegram Web** in your browser
2. **Open the chat** you want to get the ID for
3. **Look at the URL** - it will show something like: `https://web.telegram.org/k/#-1001234567890`
4. **The number after #** is your Chat ID

#### Chat ID Format Reference:

- **Personal chats**: Positive numbers (e.g., `123456789`)
- **Groups**: Negative numbers starting with `-` (e.g., `-123456789`)
- **Channels**: Negative numbers starting with `-100` (e.g., `-1001234567890`)
- **Supergroups**: Negative numbers starting with `-100` (e.g., `-1001234567890`)

#### Method 4: Using Telegram API Directly

If you have programming experience, you can also get the chat ID by:

1. **Send a message** to your bot from the group/channel
2. **Use the Telegram API** to get updates: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. **Look for the `chat` object** in the response, which contains the `id` field

### 4. Bot Permissions

Make sure your bot has the following permissions in your channel/group:

**For Groups:**
- Send Messages
- Read Messages (if needed)
- Add to group (if you want the bot to be able to add itself)

**For Channels:**
- Send Messages
- Post Messages
- Edit Messages (optional)
- Delete Messages (optional)

**Setting Permissions:**
1. Go to your group/channel settings
2. Select "Administrators" or "Permissions"
3. Find your bot in the list
4. Enable the required permissions

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