# ---- Builder Stage ----
# Use a specific version of Node.js Alpine for reproducibility
FROM node:20.13.1-alpine AS builder
# Using a more specific tag like 20.13.1-alpine instead of just 20-alpine
# helps prevent unexpected changes if 20-alpine is updated.

LABEL stage="builder"
WORKDIR /app

# --- Improved Dependency Caching ---
# 1. Copy ONLY package.json and package-lock.json (if available) for all workspaces first.
# This layer is cached if these files don't change.
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
# If you had other workspaces, you'd copy their package.json files here too.

# 2. Install ALL dependencies using `npm ci` for workspaces.
# `npm ci` is generally preferred for CI/Docker as it uses the lockfile for faster, more reliable builds.
# It will install dependencies for the root and all defined workspaces.
# This includes devDependencies needed for the build process (like react-scripts).
RUN npm ci

# 3. Copy the rest of the source code.
# If only your code changes (not dependencies), Docker reuses the layers above.
COPY . .

# 4. Build the client application.
# Use the workspace script defined in the root package.json.
RUN npm run build:client
# Alternatively, and perhaps more directly:
# RUN npm run build --workspace=client

# ---- Production Stage ----
# Use the same specific Node.js Alpine version for consistency
FROM node:20.13.1-alpine AS production

LABEL stage="production"
WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production
# The PORT can also be set here or overridden at runtime.
ENV PORT=8080

# --- Install Production Dependencies ---
# 1. Copy package files again (necessary for this stage to resolve dependencies).
COPY package.json package-lock.json* ./
COPY client/package.json ./client/  # Needed for workspace structure, though client deps are bundled
COPY server/package.json ./server/

# 2. Install ONLY production dependencies for all workspaces.
# `--omit=dev` ensures no devDependencies are installed.
RUN npm ci --omit=dev --workspaces --if-present

# --- Copy Application Artifacts ---
# 1. Copy the built client application from the builder stage.
COPY --from=builder /app/client/build ./client/build

# 2. Copy the server code.
# Assuming server code doesn't have a separate build step and is run from source.
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