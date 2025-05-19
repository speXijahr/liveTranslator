# Build stage
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN npm run install:client

# Copy source code
COPY . .

# Build the client
RUN npm run build:client

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --production
RUN npm run install:server

# Copy built client and server code
COPY --from=builder /app/client/build ./client/build
COPY server ./server

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "run", "start:server:prod"] 