# ---- Builder Stage ----
# Use a specific version of Node.js Alpine for reproducibility
FROM node:20.13.1-alpine AS builder
# Using a more specific tag like 20.13.1-alpine instead of just 20-alpine
# helps prevent unexpected changes if 20-alpine is updated.

LABEL stage="builder"
WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the client application
RUN npm run build:client

# ---- Production Stage ----
# Use the same specific Node.js Alpine version for consistency
FROM node:20.13.1-alpine AS production

LABEL stage="production"
WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production
# The PORT can also be set here or overridden at runtime.
ENV PORT=8080

# Copy package files
COPY package.json ./
COPY package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install ONLY production dependencies for all workspaces.
# `--omit=dev` ensures no devDependencies are installed.
RUN npm ci --omit=dev --workspaces --if-present

# Copy built client and server code
COPY --from=builder /app/client/build ./client/build
COPY server ./server

# Expose the port the application will run on
EXPOSE 8080

# Add a non-root user for better security (optional but recommended)
# RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# USER appuser

# Command to start the server application
# This will use the `start:prod` script from the server's package.json,
# which is delegated by the root package.json's `start:server:prod`.
CMD ["npm", "run", "start:server:prod"]
# Alternative direct execution (if server/server.js is the entry point and handles NODE_ENV):
# CMD ["node", "server/server.js"]