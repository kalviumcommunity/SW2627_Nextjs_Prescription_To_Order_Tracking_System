# syntax=docker/dockerfile:1

# ==============================================================================
# Base Stage: Standardized Node.js 20 LTS Debian Slim
# ==============================================================================
FROM node:20-slim AS base
WORKDIR /app

# Install OpenSSL so Prisma query engine targets debian-openssl-3.0.x consistently
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# ==============================================================================
# Stage 1: Dependencies (deps)
# Install full dependencies deterministically using npm ci
# ==============================================================================
FROM base AS deps

# Copy dependency specifications and Prisma schema needed for generation
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# ==============================================================================
# Stage 2: Builder (builder)
# Generate Prisma Client and compile Next.js standalone application
# ==============================================================================
FROM base AS builder
WORKDIR /app

# Copy cached dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client for Debian Linux architecture
RUN npx prisma generate

# Compile Next.js production build with standalone output
RUN npm run build

# ==============================================================================
# Stage 3: Runner (runtime)
# Minimal, hardened production image running Next.js as non-root user
# ==============================================================================
FROM node:20-slim AS runner
WORKDIR /app

# Install OpenSSL required by Prisma query engine at runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Configure production runtime environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create dedicated non-root user and group for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Copy static assets from public folder
COPY --from=builder /app/public ./public

# Prepare .next directory with proper permissions for Next.js cache
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone server output and static assets with non-root ownership
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure Prisma client and schema are available at runtime
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nextjs

# Expose Next.js server port
EXPOSE 3000

# Start Next.js standalone production server
CMD ["node", "server.js"]
