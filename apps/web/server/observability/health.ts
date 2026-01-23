/**
 * Health Check Functions
 *
 * Provides health check utilities for database, Redis, and external services.
 * Used by the admin health endpoint to monitor system status.
 */

import Redis from 'ioredis';

import { prisma } from '../db/client';
import { redisConnection } from '../jobs/config';
import { ShopifyClient } from '../shopify/client';

import { logger } from './logger';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Connection health status
 */
type ConnectionStatus = 'connected' | 'rate_limited' | 'auth_error' | 'unreachable';

/**
 * Individual Shopify connection health
 */
export interface ShopifyConnectionHealth {
  workspace_id: string;
  shop_domain: string;
  status: ConnectionStatus;
  response_time_ms: number;
  last_checked: Date;
  error?: string;
}

/**
 * Shopify health status
 */
export interface ShopifyHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: ShopifyConnectionHealth[];
  rate_limit_remaining?: number;
}

/**
 * Overall health status
 */
export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    shopify?: HealthCheckResult & { shopifyStatus?: ShopifyHealthStatus };
  };
}

/**
 * Check database connectivity and latency
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Simple query to check connectivity
    await prisma.$queryRaw`SELECT 1`;

    const latencyMs = Date.now() - startTime;

    // Warn if latency is high
    if (latencyMs > 1000) {
      logger.warn(
        { latencyMs },
        'Database health check latency is high'
      );

      return {
        status: 'degraded',
        latencyMs,
        details: {
          message: 'High latency detected',
        },
      };
    }

    return {
      status: 'healthy',
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : error,
        latencyMs,
      },
      'Database health check failed'
    );

    return {
      status: 'unhealthy',
      latencyMs,
      error:
        error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis connectivity and latency
 */
export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  let redis: Redis | null = null;

  try {
    // Create temporary Redis connection
    redis = new Redis(redisConnection);

    // Ping Redis
    await redis.ping();

    const latencyMs = Date.now() - startTime;

    // Warn if latency is high
    if (latencyMs > 500) {
      logger.warn(
        { latencyMs },
        'Redis health check latency is high'
      );

      return {
        status: 'degraded',
        latencyMs,
        details: {
          message: 'High latency detected',
        },
      };
    }

    return {
      status: 'healthy',
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : error,
        latencyMs,
      },
      'Redis health check failed'
    );

    return {
      status: 'unhealthy',
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  } finally {
    // Always disconnect
    if (redis) {
      await redis.quit();
    }
  }
}

/**
 * In-memory cache for Shopify health status
 * Cache for 30 seconds to avoid hammering Shopify API
 */
const shopifyHealthCache = new Map<string, {
  status: ShopifyHealthStatus;
  timestamp: number;
}>();

const SHOPIFY_HEALTH_CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Parse Shopify rate limit from response headers
 * Header format: "current/max" (e.g., "35/40")
 *
 * @internal Reserved for future use when rate limit header parsing is implemented
 */
function _parseShopifyRateLimit(header: string | null): {
  current: number;
  max: number;
  remaining: number;
} | null {
  if (!header) return null;

  const [current, max] = header.split('/').map((s) => parseInt(s.trim(), 10));

  if (isNaN(current) || isNaN(max)) return null;

  return {
    current,
    max,
    remaining: max - current,
  };
}

/**
 * Classify connection status from response
 */
function classifyConnectionStatus(
  statusCode: number,
  error?: Error
): ConnectionStatus {
  // Authentication errors
  if (statusCode === 401 || statusCode === 403) {
    return 'auth_error';
  }

  // Rate limiting
  if (statusCode === 429) {
    return 'rate_limited';
  }

  // Server errors or timeout
  if (statusCode >= 500 || error?.message.includes('timeout')) {
    return 'unreachable';
  }

  // Success
  if (statusCode >= 200 && statusCode < 300) {
    return 'connected';
  }

  // Other errors treated as unreachable
  return 'unreachable';
}

/**
 * Check health of a single Shopify connection
 */
async function checkSingleShopifyConnection(
  workspaceId: string,
  shopDomain: string,
  encryptedToken: string
): Promise<ShopifyConnectionHealth> {
  const startTime = Date.now();

  try {
    const client = new ShopifyClient(shopDomain, encryptedToken);

    // Make lightweight API call to check connectivity
    // Using /shop.json endpoint which returns minimal data
    await client.getShop();

    const responseTimeMs = Date.now() - startTime;

    return {
      workspace_id: workspaceId,
      shop_domain: shopDomain,
      status: 'connected',
      response_time_ms: responseTimeMs,
      last_checked: new Date(),
    };
  } catch (error: unknown) {
    const responseTimeMs = Date.now() - startTime;

    // Extract status code from error if available
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? (error.statusCode as number)
        : 500;
    const status = classifyConnectionStatus(
      statusCode,
      error instanceof Error ? error : undefined
    );

    logger.warn(
      {
        workspaceId,
        shopDomain,
        status,
        statusCode,
        responseTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      `Shopify connection health check: ${status}`
    );

    return {
      workspace_id: workspaceId,
      shop_domain: shopDomain,
      status,
      response_time_ms: responseTimeMs,
      last_checked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Shopify API health for all connections or specific workspace
 * Implements caching to avoid excessive API calls
 */
export async function checkShopifyHealth(
  workspaceId?: string
): Promise<ShopifyHealthStatus> {
  // Check cache first
  const cacheKey = workspaceId || 'all';
  const cached = shopifyHealthCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < SHOPIFY_HEALTH_CACHE_TTL_MS) {
    logger.debug(
      { workspaceId, cacheAge: Date.now() - cached.timestamp },
      'Returning cached Shopify health status'
    );
    return cached.status;
  }

  try {
    // Fetch active Shopify connections
    const connections = await prisma.shopifyConnection.findMany({
      where: {
        ...(workspaceId && { workspace_id: workspaceId }),
        status: 'active',
      },
      select: {
        workspace_id: true,
        store_domain: true,
        access_token_encrypted: true,
      },
    });

    // No connections = healthy (nothing to check)
    if (connections.length === 0) {
      const healthStatus: ShopifyHealthStatus = {
        status: 'healthy',
        connections: [],
      };

      shopifyHealthCache.set(cacheKey, {
        status: healthStatus,
        timestamp: Date.now(),
      });

      return healthStatus;
    }

    // Check all connections in parallel
    const connectionHealths = await Promise.all(
      connections.map((conn) =>
        checkSingleShopifyConnection(
          conn.workspace_id,
          conn.store_domain,
          conn.access_token_encrypted
        )
      )
    );

    // Determine overall status
    const connectedCount = connectionHealths.filter(
      (h) => h.status === 'connected'
    ).length;
    const rateLimitedCount = connectionHealths.filter(
      (h) => h.status === 'rate_limited'
    ).length;
    const authErrorCount = connectionHealths.filter(
      (h) => h.status === 'auth_error'
    ).length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (connectedCount === connections.length) {
      // All connections healthy
      overallStatus = 'healthy';
    } else if (connectedCount === 0) {
      // All connections failed
      overallStatus = 'unhealthy';
    } else {
      // Some connections failed = degraded
      overallStatus = 'degraded';
    }

    // If rate limited but some connections work, mark as degraded
    if (rateLimitedCount > 0 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    // Calculate average remaining rate limit capacity
    // Note: This would require modifying ShopifyClient to expose rate limit info
    // For now, we'll mark as degraded if any connection is rate limited

    const healthStatus: ShopifyHealthStatus = {
      status: overallStatus,
      connections: connectionHealths,
      ...(rateLimitedCount > 0 && {
        rate_limit_remaining: 0, // Simplified for now
      }),
    };

    // Cache the result
    shopifyHealthCache.set(cacheKey, {
      status: healthStatus,
      timestamp: Date.now(),
    });

    logger.info(
      {
        workspaceId,
        status: overallStatus,
        connectedCount,
        totalCount: connections.length,
        rateLimitedCount,
        authErrorCount,
      },
      'Shopify health check completed'
    );

    return healthStatus;
  } catch (error) {
    logger.error(
      {
        workspaceId,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : error,
      },
      'Shopify health check failed'
    );

    // Return unhealthy status on system errors
    return {
      status: 'unhealthy',
      connections: [],
    };
  }
}

/**
 * Check Shopify API connectivity for a specific workspace
 * This is optional and only runs if a workspace ID is provided
 *
 * @deprecated Use checkShopifyHealth instead
 */
export async function checkShopifyApiHealth(
  workspaceId: string
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const shopifyStatus = await checkShopifyHealth(workspaceId);
    const latencyMs = Date.now() - startTime;

    return {
      status: shopifyStatus.status,
      latencyMs,
      details: {
        shopifyStatus,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        workspaceId,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : error,
        latencyMs,
      },
      'Shopify API health check failed'
    );

    return {
      status: 'unhealthy',
      latencyMs,
      error:
        error instanceof Error ? error.message : 'Unknown Shopify API error',
    };
  }
}

/**
 * Get overall system health
 * Runs all health checks in parallel
 */
export async function getSystemHealth(
  workspaceId?: string
): Promise<SystemHealth> {
  const startTime = Date.now();

  logger.info({ workspaceId }, 'Running system health checks');

  // Run all health checks in parallel
  const [database, redis, shopifyResult] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    workspaceId ? checkShopifyApiHealth(workspaceId) : Promise.resolve(undefined),
  ]);

  // Determine overall status
  const allChecks = [database, redis, shopifyResult].filter(
    (check): check is HealthCheckResult => check !== undefined
  );

  const overallStatus = allChecks.some((check) => check.status === 'unhealthy')
    ? 'unhealthy'
    : allChecks.some((check) => check.status === 'degraded')
    ? 'degraded'
    : 'healthy';

  const health: SystemHealth = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      redis,
      ...(shopifyResult && { shopify: shopifyResult }),
    },
  };

  const durationMs = Date.now() - startTime;

  logger.info(
    {
      status: overallStatus,
      durationMs,
      checks: {
        database: database.status,
        redis: redis.status,
        ...(shopifyResult && { shopify: shopifyResult.status }),
      },
    },
    `Health checks completed: ${overallStatus} (${durationMs}ms)`
  );

  return health;
}

/**
 * Check if system is ready to serve traffic
 * Returns true if all critical services are healthy or degraded
 */
export async function isSystemReady(): Promise<boolean> {
  const health = await getSystemHealth();
  return health.status !== 'unhealthy';
}

/**
 * Check if system is alive (basic liveness check)
 * Returns true if the application is running
 */
export function isSystemAlive(): boolean {
  return true;
}
