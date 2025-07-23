FROM node:24 AS server

# Install build dependencies for sqlite3
RUN apt-get update
RUN apt-get -y install sqlite3 libsqlite3-dev

WORKDIR /app

# Copy package files
COPY ./package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY ./ ./

RUN npm run build
RUN npm rebuild sqlite3 --build-from-source
RUN npm playwright install

ENV STORAGE_PATH=/storage

EXPOSE 8080

# Start the application
CMD ["yarn", "start"]