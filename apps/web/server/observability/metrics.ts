/**
 * Metrics Collection
 *
 * Basic counters and timing metrics for job processing, API calls,
 * and executions. Designed for easy integration with Prometheus/DataDog.
 */

import { logger } from './logger';

/**
 * Metric types
 */
type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric value
 */
interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * Metric registry
 */
class MetricsRegistry {
  private metrics: Map<string, MetricValue[]> = new Map();
  private enabled: boolean;

  constructor() {
    // Metrics are disabled in test environment
    this.enabled = process.env.NODE_ENV !== 'test';
  }

  /**
   * Record a metric
   */
  record(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    if (!this.enabled) return;

    const key = this.getKey(name, labels);
    const existing = this.metrics.get(key) || [];

    existing.push({
      value,
      timestamp: Date.now(),
      labels,
    });

    // Keep only last 1000 values per metric to prevent memory bloat
    if (existing.length > 1000) {
      existing.shift();
    }

    this.metrics.set(key, existing);
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels?: Record<string, string>): void {
    this.record(name, 1, labels);
  }

  /**
   * Get metric values
   */
  get(name: string, labels?: Record<string, string>): MetricValue[] {
    const key = this.getKey(name, labels);
    return this.metrics.get(key) || [];
  }

  /**
   * Get all metrics
   */
  getAll(): Record<string, MetricValue[]> {
    const result: Record<string, MetricValue[]> = {};
    this.metrics.forEach((values, key) => {
      result[key] = values;
    });
    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Generate a unique key for a metric
   */
  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }

  /**
   * Get aggregate statistics for a metric
   */
  getStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.get(name, labels);
    if (values.length === 0) {
      return null;
    }

    const numbers = values.map((v) => v.value).sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const count = numbers.length;

    return {
      count,
      sum,
      avg: sum / count,
      min: numbers[0],
      max: numbers[count - 1],
      p50: numbers[Math.floor(count * 0.5)],
      p95: numbers[Math.floor(count * 0.95)],
      p99: numbers[Math.floor(count * 0.99)],
    };
  }
}

// Global metrics registry
const registry = new MetricsRegistry();

/**
 * Counter: Jobs processed
 */
export function incrementJobsProcessed(
  jobName: string,
  status: 'completed' | 'failed'
): void {
  registry.increment('jobs_processed_total', { job: jobName, status });

  logger.debug(
    { job: jobName, status },
    `Metric: jobs_processed_total{job="${jobName}",status="${status}"} +1`
  );
}

/**
 * Counter: Jobs failed
 */
export function incrementJobsFailed(jobName: string, errorType: string): void {
  registry.increment('jobs_failed_total', { job: jobName, error: errorType });

  logger.debug(
    { job: jobName, error: errorType },
    `Metric: jobs_failed_total{job="${jobName}",error="${errorType}"} +1`
  );
}

/**
 * Counter: Executions total
 */
export function incrementExecutionsTotal(
  actionType: string,
  status: 'success' | 'failed'
): void {
  registry.increment('executions_total', { action: actionType, status });

  logger.debug(
    { action: actionType, status },
    `Metric: executions_total{action="${actionType}",status="${status}"} +1`
  );
}

/**
 * Histogram: Job duration
 */
export function recordJobDuration(jobName: string, durationMs: number): void {
  registry.record('job_duration_ms', durationMs, { job: jobName });

  logger.debug(
    { job: jobName, durationMs },
    `Metric: job_duration_ms{job="${jobName}"} ${durationMs}`
  );
}

/**
 * Histogram: API latency
 */
export function recordApiLatency(
  method: string,
  endpoint: string,
  statusCode: number,
  durationMs: number
): void {
  registry.record('api_latency_ms', durationMs, {
    method,
    endpoint,
    status: statusCode.toString(),
  });

  logger.debug(
    { method, endpoint, statusCode, durationMs },
    `Metric: api_latency_ms{method="${method}",endpoint="${endpoint}",status="${statusCode}"} ${durationMs}`
  );
}

/**
 * Histogram: Database query duration
 */
export function recordDatabaseQueryDuration(
  operation: string,
  table: string,
  durationMs: number
): void {
  registry.record('db_query_duration_ms', durationMs, {
    operation,
    table,
  });
}

/**
 * Counter: Opportunities generated
 */
export function incrementOpportunitiesGenerated(
  opportunityType: string,
  priority: string
): void {
  registry.increment('opportunities_generated_total', {
    type: opportunityType,
    priority,
  });
}

/**
 * Counter: Actions approved
 */
export function incrementActionsApproved(actionType: string): void {
  registry.increment('actions_approved_total', { action: actionType });
}

/**
 * Counter: Actions dismissed
 */
export function incrementActionsDismissed(actionType: string): void {
  registry.increment('actions_dismissed_total', { action: actionType });
}

/**
 * Counter: Outcomes computed
 */
export function incrementOutcomesComputed(
  outcome: 'helped' | 'neutral' | 'hurt'
): void {
  registry.increment('outcomes_computed_total', { outcome });
}

/**
 * Gauge: Queue size
 */
export function setQueueSize(queueName: string, size: number): void {
  registry.record('queue_size', size, { queue: queueName });
}

/**
 * Gauge: Active jobs
 */
export function setActiveJobs(queueName: string, count: number): void {
  registry.record('queue_active_jobs', count, { queue: queueName });
}

/**
 * Counter: Webhook received
 */
export function incrementWebhooksReceived(
  topic: string,
  status: 'valid' | 'invalid'
): void {
  registry.increment('webhooks_received_total', { topic, status });
}

/**
 * Histogram: Shopify API call duration
 */
export function recordShopifyApiDuration(
  endpoint: string,
  durationMs: number
): void {
  registry.record('shopify_api_duration_ms', durationMs, { endpoint });
}

/**
 * Timer helper - automatically records duration when done
 */
export class Timer {
  private startTime: number;
  private name: string;
  private labels?: Record<string, string>;

  constructor(name: string, labels?: Record<string, string>) {
    this.startTime = Date.now();
    this.name = name;
    this.labels = labels;
  }

  /**
   * Stop the timer and record the duration
   */
  stop(): number {
    const duration = Date.now() - this.startTime;
    registry.record(this.name, duration, this.labels);
    return duration;
  }

  /**
   * Get elapsed time without stopping
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Start a timer
 */
export function startTimer(
  name: string,
  labels?: Record<string, string>
): Timer {
  return new Timer(name, labels);
}

/**
 * Get all metrics (for admin/monitoring endpoints)
 */
export function getAllMetrics(): Record<string, MetricValue[]> {
  return registry.getAll();
}

/**
 * Get metric statistics
 */
export function getMetricStats(
  name: string,
  labels?: Record<string, string>
): ReturnType<typeof registry.getStats> {
  return registry.getStats(name, labels);
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics(): void {
  registry.clear();
}

/**
 * Export Prometheus-compatible format
 */
export function exportPrometheus(): string {
  const lines: string[] = [];
  const allMetrics = registry.getAll();

  Object.entries(allMetrics).forEach(([key, values]) => {
    const lastValue = values[values.length - 1];
    if (lastValue) {
      lines.push(`${key} ${lastValue.value} ${lastValue.timestamp}`);
    }
  });

  return lines.join('\n');
}

/**
 * Health check metric
 */
export function recordHealthCheck(component: string, status: 'healthy' | 'unhealthy'): void {
  registry.record('health_check', status === 'healthy' ? 1 : 0, { component });
}
