# MerchOps Kubernetes Deployment

Production-grade Kubernetes manifests for deploying MerchOps on any Kubernetes cluster (GKE, EKS, AKS, self-hosted).

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- PostgreSQL database (managed or in-cluster)
- Redis instance (managed or in-cluster)
- Ingress controller (nginx recommended)
- cert-manager for SSL certificates (optional)

## Quick Deploy

### 1. Create Namespace
```bash
kubectl apply -f namespace.yaml
```

### 2. Create Secrets
```bash
kubectl create secret generic merchops-secrets \
  --from-literal=database-url='postgresql://user:pass@host:5432/db?schema=public' \
  --from-literal=redis-url='redis://host:6379/0' \
  --from-literal=nextauth-secret='your-secret-here' \
  --from-literal=nextauth-url='https://merchops.example.com' \
  --from-literal=encryption-key='your-64-char-hex-key' \
  --from-literal=shopify-client-id='your-client-id' \
  --from-literal=shopify-client-secret='your-client-secret' \
  --from-literal=shopify-webhook-secret='your-webhook-secret' \
  --from-literal=anthropic-api-key='your-anthropic-key' \
  --from-literal=email-provider-api-key='your-email-key' \
  -n merchops
```

### 3. Apply Configuration
```bash
kubectl apply -f configmap.yaml
```

### 4. Deploy Application
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### 5. Configure Ingress
```bash
# Edit ingress.yaml with your domain
kubectl apply -f ingress.yaml
```

### 6. Enable Auto-Scaling (Optional)
```bash
kubectl apply -f hpa.yaml
```

## Verify Deployment

```bash
# Check pods
kubectl get pods -n merchops

# Check services
kubectl get svc -n merchops

# Check ingress
kubectl get ingress -n merchops

# View logs
kubectl logs -f deployment/merchops-web -n merchops
```

## Scaling

### Manual Scaling
```bash
# Scale web pods
kubectl scale deployment merchops-web --replicas=3 -n merchops

# Scale worker pods
kubectl scale deployment merchops-worker --replicas=2 -n merchops
```

### Auto-Scaling
Auto-scaling is configured in `hpa.yaml`:
- Web: 2-10 replicas based on CPU/memory
- Worker: 1-5 replicas based on CPU/memory

## Database Migrations

```bash
# Run migrations from web pod
kubectl exec -it deployment/merchops-web -n merchops -- pnpm prisma migrate deploy
```

## Monitoring

```bash
# Watch resource usage
kubectl top pods -n merchops

# View events
kubectl get events -n merchops --sort-by='.lastTimestamp'

# Tail logs
kubectl logs -f -l app=merchops -n merchops --all-containers
```

## Troubleshooting

### Pods Not Starting
```bash
kubectl describe pod <pod-name> -n merchops
kubectl logs <pod-name> -n merchops
```

### Connection Issues
```bash
# Test database connectivity
kubectl exec -it deployment/merchops-web -n merchops -- nc -zv <db-host> 5432

# Test Redis connectivity
kubectl exec -it deployment/merchops-web -n merchops -- nc -zv <redis-host> 6379
```

### Update Secrets
```bash
# Delete old secret
kubectl delete secret merchops-secrets -n merchops

# Create new secret
kubectl create secret generic merchops-secrets ... -n merchops

# Restart deployments
kubectl rollout restart deployment/merchops-web -n merchops
kubectl rollout restart deployment/merchops-worker -n merchops
```

## SSL/TLS Configuration

### Using cert-manager
1. Install cert-manager: https://cert-manager.io/docs/installation/
2. Create ClusterIssuer:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```
3. Apply ingress.yaml (configured for cert-manager)

### Using External Certificate
```bash
kubectl create secret tls merchops-tls \
  --cert=path/to/cert.crt \
  --key=path/to/key.key \
  -n merchops
```

## Backup and Recovery

### Database Backup
```bash
# Create backup job
kubectl run backup-$(date +%Y%m%d) \
  --image=postgres:16-alpine \
  --restart=Never \
  --env="PGPASSWORD=yourpass" \
  -n merchops \
  -- pg_dump -h dbhost -U dbuser dbname > backup.sql
```

### Restore from Backup
```bash
kubectl run restore \
  --image=postgres:16-alpine \
  --restart=Never \
  --env="PGPASSWORD=yourpass" \
  -n merchops \
  -- psql -h dbhost -U dbuser dbname < backup.sql
```

## Updates and Rollbacks

### Update Application
```bash
# Update image
kubectl set image deployment/merchops-web web=merchops/web:v2.0 -n merchops

# Watch rollout
kubectl rollout status deployment/merchops-web -n merchops
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/merchops-web -n merchops

# Rollback to specific revision
kubectl rollout undo deployment/merchops-web --to-revision=2 -n merchops
```

## Clean Up

```bash
# Delete all resources
kubectl delete namespace merchops

# Or selectively
kubectl delete -f .
```
