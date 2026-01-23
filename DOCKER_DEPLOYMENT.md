# MerchOps Docker Deployment Guide

Production-ready containerization for deploying MerchOps to any container platform (Render, Railway, Fly.io, AWS ECS, Google Cloud Run, Kubernetes, etc.).

## Architecture Overview

The MerchOps application is containerized using a multi-stage Docker build:

- **Stage 1: Base** - Sets up Node.js 20 Alpine and pnpm
- **Stage 2: Dependencies** - Installs production dependencies
- **Stage 3: Builder** - Builds Next.js with standalone output
- **Stage 4: Runner** - Minimal production runtime with non-root user

The stack includes:
- **Web Service**: Next.js application (port 3000)
- **Worker Service**: BullMQ background job processor
- **PostgreSQL**: Primary database (port 5432)
- **Redis**: Job queue and caching (port 6379)

---

## Quick Start

### 1. Build the Docker Image

```bash
# Standard build
pnpm docker:build

# Multi-platform build (for ARM/AMD deployment)
pnpm docker:build:platform
```

### 2. Configure Environment

```bash
# Copy template
cp .env.docker .env.production

# Edit with your production values
nano .env.production
```

**Critical values to change:**
- `POSTGRES_PASSWORD` - Secure database password
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32`
- `NEXTAUTH_URL` - Your production domain
- `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`
- `EMAIL_PROVIDER_API_KEY`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

### 3. Run Production Stack

```bash
# Start all services
pnpm docker:run

# Run database migrations
pnpm docker:migrate

# View logs
pnpm docker:logs

# Stop services
pnpm docker:stop
```

---

## Platform-Specific Deployment

### Render

**1. Create PostgreSQL Database**
- Go to Dashboard > New > PostgreSQL
- Copy the Internal Database URL

**2. Create Redis Instance**
- Go to Dashboard > New > Redis
- Copy the Redis URL

**3. Deploy Web Service**
- Go to Dashboard > New > Web Service
- Connect your GitHub repository
- Configure:
  - **Build Command**: `docker build -t merchops .`
  - **Start Command**: `node apps/web/server.js`
  - **Environment**: Docker
  - **Port**: 3000

**4. Add Environment Variables**
- Add all variables from `.env.docker`
- Use Internal URLs for `DATABASE_URL` and `REDIS_URL`

**5. Deploy Worker Service**
- Create another Web Service
- Same repository and Docker build
- **Start Command**: `node -r tsx/register apps/web/src/server/jobs/worker.ts`

### Railway

**1. Create New Project**
```bash
railway login
railway init
```

**2. Add Services**
```bash
# Add PostgreSQL
railway add --plugin postgresql

# Add Redis
railway add --plugin redis

# Deploy application
railway up
```

**3. Configure Environment**
- Railway automatically provisions `DATABASE_URL` and `REDIS_URL`
- Add remaining variables via Railway Dashboard or CLI:
```bash
railway variables set NEXTAUTH_SECRET=your-secret
railway variables set ENCRYPTION_KEY=your-key
# ... add all other variables
```

**4. Deploy**
```bash
railway up --detach
```

### Fly.io

**1. Install Fly CLI**
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

**2. Create App**
```bash
fly launch --no-deploy
```

**3. Provision PostgreSQL**
```bash
fly postgres create --name merchops-db
fly postgres attach merchops-db
```

**4. Provision Redis**
```bash
fly redis create --name merchops-redis
fly redis attach merchops-redis
```

**5. Set Environment Variables**
```bash
fly secrets set NEXTAUTH_SECRET=your-secret
fly secrets set ENCRYPTION_KEY=your-key
fly secrets set SHOPIFY_CLIENT_ID=your-id
# ... add all other secrets
```

**6. Deploy**
```bash
fly deploy
```

**7. Scale Workers (Optional)**
```bash
fly scale count 2 --process-group worker
```

### AWS ECS (Fargate)

**1. Build and Push to ECR**
```bash
# Create ECR repository
aws ecr create-repository --repository-name merchops/web

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build for AMD64 (Fargate default)
docker buildx build --platform linux/amd64 -t YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/merchops/web:latest .

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/merchops/web:latest
```

**2. Set Up Infrastructure**
- Create RDS PostgreSQL instance
- Create ElastiCache Redis cluster
- Create Application Load Balancer
- Create ECS Cluster (Fargate)

**3. Create Task Definition**
```json
{
  "family": "merchops-web",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/merchops/web:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "NEXTAUTH_SECRET", "valueFrom": "arn:aws:secretsmanager:..."}
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 40
      }
    }
  ]
}
```

**4. Create Service**
```bash
aws ecs create-service \
  --cluster merchops-cluster \
  --service-name merchops-web \
  --task-definition merchops-web \
  --desired-count 2 \
  --launch-type FARGATE \
  --load-balancers targetGroupArn=arn:aws:...,containerName=web,containerPort=3000
```

### Google Cloud Run

**1. Build and Push to Artifact Registry**
```bash
# Configure Docker for GCP
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/merchops/web:latest .
docker push us-central1-docker.pkg.dev/PROJECT_ID/merchops/web:latest
```

**2. Create Cloud SQL PostgreSQL**
```bash
gcloud sql instances create merchops-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1
```

**3. Create Memorystore Redis**
```bash
gcloud redis instances create merchops-redis \
  --size=1 \
  --region=us-central1
```

**4. Deploy to Cloud Run**
```bash
gcloud run deploy merchops-web \
  --image=us-central1-docker.pkg.dev/PROJECT_ID/merchops/web:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest" \
  --add-cloudsql-instances=PROJECT_ID:us-central1:merchops-db
```

### Kubernetes

See `k8s/` directory for full Kubernetes manifests including:
- Deployment configurations
- Service definitions
- Ingress setup
- ConfigMaps and Secrets
- HorizontalPodAutoscaler

```bash
# Apply configurations
kubectl apply -f k8s/

# Check status
kubectl get pods -n merchops
```

---

## Container Configuration

### Environment Variables

All environment variables from `.env.docker` must be provided:

#### Required
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Session encryption key
- `NEXTAUTH_URL` - Application URL
- `ENCRYPTION_KEY` - Shopify token encryption key
- `SHOPIFY_CLIENT_ID` - OAuth client ID
- `SHOPIFY_CLIENT_SECRET` - OAuth client secret
- `SHOPIFY_WEBHOOK_SECRET` - Webhook HMAC verification

#### AI Provider (at least one)
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - GPT-4 API key

#### Optional
- `SENTRY_DSN` - Error tracking
- `EMAIL_PROVIDER_API_KEY` - Resend/SendGrid
- `LOG_LEVEL` - debug, info, warn, error

### Health Checks

The application exposes health endpoints:

**Lightweight Check** (for load balancers):
```bash
curl http://localhost:3000/api/health
```

**Detailed Check** (requires auth):
```bash
curl http://localhost:3000/api/admin/health
```

### Resource Requirements

**Minimum (Development)**:
- CPU: 0.5 cores
- Memory: 512MB
- Disk: 1GB

**Recommended (Production)**:
- CPU: 1-2 cores
- Memory: 1-2GB
- Disk: 10GB (for logs and temp files)

**Database**:
- PostgreSQL: 1GB RAM minimum
- Storage: 10GB+ (scales with usage)

**Redis**:
- Memory: 256MB minimum (scales with queue size)

### Networking

**Exposed Ports**:
- Web: 3000 (HTTP)

**Internal Communication**:
- PostgreSQL: 5432
- Redis: 6379

**Ingress Requirements**:
- HTTPS required for production
- WebSocket support not required
- Session affinity not required (stateless)

---

## Database Migrations

### First Deployment

```bash
# After containers start, run migrations
pnpm docker:migrate

# Or directly with Docker
docker compose -f docker-compose.prod.yml exec web pnpm prisma migrate deploy
```

### Subsequent Deployments

Migrations run automatically during deployment via Prisma's `migrate deploy` command in the CI/CD pipeline.

### Manual Migration

```bash
# Access container
docker exec -it merchops-web sh

# Run migration
pnpm prisma migrate deploy

# Or specific migration
pnpm prisma migrate resolve --applied MIGRATION_NAME
```

---

## Monitoring and Observability

### Logs

**View all logs**:
```bash
pnpm docker:logs
```

**Service-specific logs**:
```bash
docker logs merchops-web -f
docker logs merchops-worker -f
docker logs merchops-postgres -f
docker logs merchops-redis -f
```

### Metrics

The application exposes metrics via:
- Sentry (if configured)
- Application logs (structured JSON via Pino)
- Health check endpoint

### Alerting

Set up alerts for:
- Container restarts
- Health check failures
- High memory usage (>80%)
- Database connection errors
- Job queue backlog

---

## Security Considerations

### Image Security

- Base image: Node.js 20 Alpine (minimal attack surface)
- Non-root user: `nextjs` (UID 1001)
- No unnecessary packages
- Multi-stage build (no dev dependencies in production)

### Runtime Security

- All secrets via environment variables (never in code)
- Shopify tokens encrypted at rest with `ENCRYPTION_KEY`
- HTTPS enforced via security headers
- CSRF protection enabled
- Rate limiting configurable

### Network Security

- Private network for internal services
- Expose only port 3000 publicly
- PostgreSQL and Redis not exposed to internet
- Use VPC/private networking in cloud providers

---

## Scaling

### Horizontal Scaling

**Web Service**:
```bash
# Scale web replicas
docker compose -f docker-compose.prod.yml up -d --scale web=3
```

For cloud platforms, use auto-scaling:
- **AWS ECS**: Configure service auto-scaling
- **Google Cloud Run**: Set min/max instances
- **Kubernetes**: Use HorizontalPodAutoscaler

**Worker Service**:
```bash
# Scale worker replicas
docker compose -f docker-compose.prod.yml up -d --scale worker=2
```

### Vertical Scaling

Increase container resources in platform-specific configs:
- Render: Change instance type
- Railway: Adjust memory/CPU limits
- Kubernetes: Update resource requests/limits

### Database Scaling

- Enable connection pooling (already configured in DATABASE_URL)
- Use read replicas for reporting queries
- Upgrade PostgreSQL instance size as needed

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs merchops-web

# Common issues:
# 1. Missing environment variables
# 2. Database not accessible
# 3. Port already in use
```

### Database Connection Errors

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check connectivity from web container
docker exec merchops-web nc -zv postgres 5432

# Verify DATABASE_URL format
docker exec merchops-web env | grep DATABASE_URL
```

### Migration Failures

```bash
# Check Prisma Client version matches schema
docker exec merchops-web pnpm prisma --version

# Regenerate Prisma Client
docker exec merchops-web pnpm prisma generate

# Force resolve migration
docker exec merchops-web pnpm prisma migrate resolve --applied MIGRATION_NAME
```

### High Memory Usage

```bash
# Check container stats
docker stats merchops-web

# Optimize Next.js memory
# Set NODE_OPTIONS='--max-old-space-size=1024' in environment
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker logs merchops-worker -f

# Verify Redis connection
docker exec merchops-worker nc -zv redis 6379

# Check queue status
docker exec merchops-web redis-cli -h redis LLEN bull:merchops:wait
```

---

## Backup and Recovery

### Database Backup

```bash
# Backup database
docker exec merchops-postgres pg_dump -U merchops merchops_production > backup.sql

# Restore database
cat backup.sql | docker exec -i merchops-postgres psql -U merchops -d merchops_production
```

### Volume Backup

```bash
# Backup all volumes
docker run --rm \
  -v merchops-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

---

## CI/CD Integration

See `.github/workflows/docker.yml` for automated Docker build and push.

**GitHub Actions Example**:
```yaml
- name: Build Docker image
  run: pnpm docker:build

- name: Push to registry
  run: pnpm docker:push
```

---

## Cost Optimization

### Development
- Use smallest instance sizes
- Stop services when not in use
- Use free tier databases (Render, Railway)

### Production
- Enable auto-scaling with low min instances
- Use managed PostgreSQL (cheaper than self-hosted)
- Use Memorystore/ElastiCache (cheaper than self-hosted Redis)
- Enable gzip/brotli compression
- Configure CDN for static assets

---

## Support

For deployment issues:
1. Check logs: `pnpm docker:logs`
2. Verify environment variables
3. Check health endpoint: `curl http://localhost:3000/api/health`
4. Review platform-specific documentation

For production issues:
- Check Sentry for error traces
- Review application logs
- Monitor database performance
- Check worker queue backlog
