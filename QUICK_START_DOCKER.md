# MerchOps Docker - Quick Start Guide

## Prerequisites

- Docker Desktop or Docker Engine installed
- Docker Compose v2.0+
- 4GB+ RAM available for containers

## Local Development with Docker

### 1. Start Development Services

```bash
# Start PostgreSQL and Redis only (for local Next.js development)
pnpm services:start

# Or start full stack with hot reload
pnpm docker:dev
```

### 2. Stop Services

```bash
pnpm services:stop
# or
pnpm docker:dev:down
```

## Production Build and Deployment

### 1. Configure Environment

```bash
# Copy production template
cp .env.docker .env.production

# Edit with your production values
# CRITICAL: Change these values!
# - POSTGRES_PASSWORD
# - NEXTAUTH_SECRET (generate: openssl rand -base64 32)
# - ENCRYPTION_KEY (generate: openssl rand -hex 32)
# - SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET
# - ANTHROPIC_API_KEY or OPENAI_API_KEY
nano .env.production
```

### 2. Build Docker Image

```bash
# Standard build (current platform)
pnpm docker:build

# Multi-platform build (for cloud deployment)
pnpm docker:build:platform
```

### 3. Deploy Production Stack

```bash
# Start all services (web, worker, postgres, redis)
pnpm docker:run

# Run database migrations
pnpm docker:migrate

# View logs
pnpm docker:logs

# Check status
docker ps
```

### 4. Verify Deployment

```bash
# Health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","timestamp":"2026-01-23T..."}
```

## Available Commands

```bash
# Development
pnpm docker:dev              # Run with hot reload
pnpm docker:dev:down         # Stop development containers

# Production
pnpm docker:build            # Build production image
pnpm docker:build:platform   # Build for AMD64 + ARM64
pnpm docker:run              # Start production stack
pnpm docker:stop             # Stop production stack
pnpm docker:logs             # View all logs
pnpm docker:clean            # Remove containers and volumes
pnpm docker:migrate          # Run database migrations
pnpm docker:push             # Push image to registry

# Database
pnpm db:start                # Start PostgreSQL only
pnpm db:stop                 # Stop PostgreSQL
pnpm db:logs                 # View PostgreSQL logs
pnpm db:shell                # Access database shell

# Redis
pnpm redis:start             # Start Redis only
pnpm redis:stop              # Stop Redis
pnpm redis:logs              # View Redis logs
pnpm redis:cli               # Access Redis CLI
```

## Docker Compose Files

- **`docker-compose.dev.yml`** - Development services (DB + Redis only)
- **`docker-compose.prod.yml`** - Full production stack
- **`docker-compose.override.yml`** - Development overrides (hot reload)
- **`docker-compose.yml`** - Base configuration (legacy, use dev or prod)

## Troubleshooting

### Port Conflicts

```bash
# Check what's using port 3000
lsof -i :3000

# Or use different port
PORT=3001 pnpm docker:run
```

### Container Won't Start

```bash
# Check logs
pnpm docker:logs

# Check specific container
docker logs merchops-web

# Restart specific service
docker compose -f docker-compose.prod.yml restart web
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs merchops-postgres

# Test connection from web container
docker exec merchops-web nc -zv postgres 5432
```

### Reset Everything

```bash
# Stop and remove all containers and volumes
pnpm docker:clean

# Start fresh
pnpm docker:run
pnpm docker:migrate
```

### Memory Issues

```bash
# Check Docker resource usage
docker stats

# Increase Docker Desktop memory limit:
# Docker Desktop → Settings → Resources → Memory → 4GB+
```

## Cloud Platform Deployment

### Push to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag image
docker tag merchops/web:latest ghcr.io/USERNAME/merchops:latest

# Push
pnpm docker:push
```

### Deploy to Render

1. Create PostgreSQL and Redis instances
2. Create Web Service → Docker
3. Set environment variables from `.env.docker`
4. Deploy

### Deploy to Railway

```bash
railway login
railway init
railway add --plugin postgresql
railway add --plugin redis
railway up
```

### Deploy to Fly.io

```bash
fly auth login
fly launch --no-deploy
fly postgres create
fly redis create
fly deploy
```

## Security Checklist

Before deploying to production:

- [ ] Change `POSTGRES_PASSWORD` from default
- [ ] Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`
- [ ] Generate `ENCRYPTION_KEY` with `openssl rand -hex 32`
- [ ] Configure Shopify OAuth credentials
- [ ] Add AI provider API key (Anthropic or OpenAI)
- [ ] Configure email provider API key
- [ ] Set `NEXTAUTH_URL` to production domain (https://...)
- [ ] Enable HTTPS/SSL
- [ ] Set up Sentry for error tracking (optional)
- [ ] Configure backups for PostgreSQL
- [ ] Set up monitoring and alerts

## Resource Requirements

### Minimum (Testing)
- CPU: 1 core
- Memory: 2GB
- Disk: 5GB

### Recommended (Production)
- CPU: 2-4 cores
- Memory: 4-8GB
- Disk: 20GB

### Per Container
- **Web**: 512MB-1GB RAM, 0.25-1 CPU
- **Worker**: 256MB-512MB RAM, 0.1-0.5 CPU
- **PostgreSQL**: 1GB RAM, 1 CPU
- **Redis**: 256MB RAM, 0.1 CPU

## Monitoring

### Check Container Health

```bash
# All containers
docker ps

# Health status
docker inspect merchops-web | grep -A 5 Health

# Resource usage
docker stats merchops-web
```

### View Logs

```bash
# All services
pnpm docker:logs

# Specific service
docker logs -f merchops-web
docker logs -f merchops-worker
docker logs -f merchops-postgres
docker logs -f merchops-redis

# Last 100 lines
docker logs --tail 100 merchops-web

# Since 10 minutes ago
docker logs --since 10m merchops-web
```

### Database Management

```bash
# Access PostgreSQL shell
pnpm db:shell

# Run SQL query
docker exec merchops-postgres psql -U merchops -d merchops_production -c "SELECT COUNT(*) FROM workspaces;"

# Backup database
docker exec merchops-postgres pg_dump -U merchops merchops_production > backup.sql

# Restore database
cat backup.sql | docker exec -i merchops-postgres psql -U merchops merchops_production
```

### Redis Management

```bash
# Access Redis CLI
pnpm redis:cli

# Check queue status
docker exec merchops-redis redis-cli LLEN bull:merchops:wait

# Clear all Redis data (CAUTION)
docker exec merchops-redis redis-cli FLUSHALL
```

## Next Steps

1. **Development**: Use `pnpm docker:dev` for local development with hot reload
2. **Testing**: Build and run production stack locally to verify
3. **Deploy**: Choose platform (Render, Railway, Fly.io) and follow deployment guide
4. **Monitor**: Set up logging, metrics, and alerts
5. **Scale**: Configure auto-scaling based on traffic

## Documentation

- **Full Deployment Guide**: `DOCKER_DEPLOYMENT.md`
- **Kubernetes Deployment**: `k8s/README.md`
- **Environment Template**: `.env.docker`
- **Implementation Summary**: `CONTAINER_DEPLOYMENT_SUMMARY.md`

## Support

For issues:
1. Check logs: `pnpm docker:logs`
2. Verify environment variables are set
3. Ensure ports aren't in use
4. Check Docker has sufficient resources
5. Review platform-specific documentation

---

**Quick Links:**
- [Render Deployment](DOCKER_DEPLOYMENT.md#render)
- [Railway Deployment](DOCKER_DEPLOYMENT.md#railway)
- [Fly.io Deployment](DOCKER_DEPLOYMENT.md#flyio)
- [AWS ECS Deployment](DOCKER_DEPLOYMENT.md#aws-ecs-fargate)
- [Google Cloud Run](DOCKER_DEPLOYMENT.md#google-cloud-run)
- [Kubernetes](k8s/README.md)
