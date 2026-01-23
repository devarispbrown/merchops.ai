'use client';

import { useState, useEffect } from 'react';

import { HealthStatus, SystemHealth } from '@/components/admin/HealthStatus';
import { JobQueueSummary, QueueStats } from '@/components/admin/JobQueueSummary';
import { RecentErrors, ErrorEntry } from '@/components/admin/RecentErrors';
import { ApiError } from '@/components/errors/ApiError';
import { LoadingPage } from '@/components/ui/Loading';

export default function AdminPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [queues, setQueues] = useState<QueueStats[] | null>(null);
  const [errors, setErrors] = useState<ErrorEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);

  const fetchAdminData = async () => {
    try {
      setError(null);

      // Fetch health status
      const healthRes = await fetch('/api/admin/health');
      if (!healthRes.ok) throw new Error('Failed to fetch health status');
      const healthData = await healthRes.json();

      // Fetch queue stats
      const queuesRes = await fetch('/api/admin/jobs');
      if (!queuesRes.ok) throw new Error('Failed to fetch queue stats');
      const queuesData = await queuesRes.json();

      // Transform queues data to match expected format
      const transformedQueues: QueueStats[] = queuesData.queues.map((q: {
        name: string;
        counts: { waiting: number; active: number; completed: number; failed: number; delayed: number };
        isPaused: boolean;
      }) => ({
        name: q.name,
        waiting: q.counts.waiting,
        active: q.counts.active,
        completed: q.counts.completed,
        failed: q.counts.failed,
        delayed: q.counts.delayed,
        isPaused: q.isPaused,
      }));

      // Fetch recent errors (placeholder - not implemented yet)
      const errorsData: ErrorEntry[] = [];

      // Parse dates
      const parsedHealth: SystemHealth = {
        ...healthData,
        database: {
          ...healthData.database,
          lastChecked: new Date(healthData.database.lastChecked),
        },
        redis: {
          ...healthData.redis,
          lastChecked: new Date(healthData.redis.lastChecked),
        },
        shopify: healthData.shopify
          ? {
              ...healthData.shopify,
              lastChecked: new Date(healthData.shopify.lastChecked),
            }
          : undefined,
      };

      setHealth(parsedHealth);
      setQueues(transformedQueues);
      setErrors(errorsData);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError({
        message: err instanceof Error ? err.message : 'Unknown error',
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAdminData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <LoadingPage />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            System health, queue status, and error monitoring
          </p>
        </div>
        <ApiError error={error} onRetry={fetchAdminData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          System health, queue status, and error monitoring
        </p>
      </div>

      {/* Health Status */}
      {health && <HealthStatus health={health} />}

      {/* Job Queue Summary */}
      {queues && <JobQueueSummary queues={queues} />}

      {/* Recent Errors */}
      {errors && (
        <RecentErrors
          errors={errors}
          maxDisplay={10}
          onViewFullLogs={() => {
            // Navigate to full logs or open external logging system
            // TODO: Implement full logs navigation
          }}
        />
      )}

      {/* Last Updated */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Auto-refreshes every 30 seconds
        </p>
      </div>
    </div>
  );
}
