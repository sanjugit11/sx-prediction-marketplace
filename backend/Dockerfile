# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies
RUN npm ci

# Copy source code and database models
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate --schema=src/database/prisma/schema.prisma

# Build TypeScript code
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled code from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/database/prisma ./src/database/prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
