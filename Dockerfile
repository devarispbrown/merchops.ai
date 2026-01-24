# ============================================================================
# MerchOps Beta MVP - Production Dockerfile
# Multi-stage build for optimized image size and security
# ============================================================================

# Stage 1: Base - Install dependencies
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@8.15.0

# Set working directory
WORKDIR /app

# Install OpenSSL for Prisma (required for Alpine)
RUN apk add --no-cache openssl libc6-compat

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# ============================================================================
# Stage 2: Dependencies - Install all dependencies
FROM base AS deps

# Copy all package.json files for workspace resolution
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY prisma ./prisma

# Install dependencies with frozen lockfile (production-safe)
RUN pnpm install --frozen-lockfile --prefer-offline

# ============================================================================
# Stage 3: Builder - Build the application
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Generate Prisma Client
RUN pnpm prisma:generate

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the web app
RUN pnpm --filter @merchops/web build

# ============================================================================
# Stage 4: Runner - Production runtime
FROM node:20-alpine AS runner

# Install pnpm and required runtime dependencies
RUN npm install -g pnpm@8.15.0 && \
    apk add --no-cache \
    openssl \
    libc6-compat \
    curl \
    dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy workspace configuration
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./

# Copy Prisma schema for migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy node_modules (production dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy shared package
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared ./packages/shared

# Copy web app with build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/next.config.mjs ./apps/web/

# Create directory for temporary files
RUN mkdir -p /tmp && chown nextjs:nodejs /tmp

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the Next.js server using pnpm
CMD ["pnpm", "--filter", "@merchops/web", "start"]
