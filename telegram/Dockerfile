FROM node:23-alpine

# Set environment variables
ENV PORT=80
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including TypeScript globally
RUN npm i && npm install -g typescript

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

ENV DATA_BACKEND_URL=https://agent.api.eternalai.org

# Start the application
CMD ["npm", "start"] 