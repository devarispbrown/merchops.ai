'use client';

import { ExecutionStatus } from '@prisma/client';
import { useState } from 'react';

import { ExecutionFilters } from '@/components/executions/ExecutionFilters';
import { ExecutionList } from '@/components/executions/ExecutionList';
import { TrackRecord } from '@/components/history/TrackRecord';
import { Card } from '@/components/ui/Card';
import { useConfidenceScores } from '@/lib/hooks/useConfidence';
import { useExecutionsList } from '@/lib/hooks/useExecutions';
import { formatNumber, formatPercentage } from '@/lib/utils/formatters';

export default function HistoryPage() {
  const [filters, setFilters] = useState<{
    status?: ExecutionStatus | 'all';
    executionType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }>({
    status: 'all',
    page: 1,
    limit: 20,
  });

  // Build API filters
  const apiFilters = {
    filters: {
      status: filters.status !== 'all' ? [filters.status as ExecutionStatus] : undefined,
      from_date: filters.dateFrom?.toISOString(),
      to_date: filters.dateTo?.toISOString(),
    },
    page: filters.page,
    limit: filters.limit,
  };

  const { data: executionsData, isLoading: isLoadingExecutions } =
    useExecutionsList(apiFilters);
  const { data: confidenceScores, isLoading: isLoadingConfidence } =
    useConfidenceScores();

  const handleFilterChange = (newFilters: {
    status?: ExecutionStatus | 'all';
    executionType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => {
    setFilters({ ...newFilters, page: 1, limit: filters.limit });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  // Calculate summary stats from executions
  const stats = executionsData?.data
    ? {
        total: executionsData.pagination.total,
        succeeded: executionsData.data.filter((e) => e.status === 'succeeded')
          .length,
        failed: executionsData.data.filter((e) => e.status === 'failed').length,
        pending: executionsData.data.filter(
          (e) => e.status === 'pending' || e.status === 'running'
        ).length,
        successRate:
          executionsData.data.filter((e) => e.status === 'succeeded').length /
          Math.max(executionsData.data.length, 1),
      }
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Execution History
        </h1>
        <p className="text-muted-foreground">
          Track what has run and see outcomes without hype.
        </p>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {formatNumber(stats.total)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Total Executions
              </div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {formatNumber(stats.succeeded)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Succeeded
              </div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-error">
                {formatNumber(stats.failed)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Failed</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {formatPercentage(stats.successRate)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Success Rate
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Track Record */}
      {confidenceScores && !isLoadingConfidence && (
        <div className="mb-8">
          <TrackRecord confidenceScores={confidenceScores} />
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Filters</h2>
        <ExecutionFilters
          currentFilters={filters}
          onFilterChange={handleFilterChange}
        />
      </Card>

      {/* Execution List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {executionsData
              ? `${formatNumber(executionsData.pagination.total)} Executions`
              : 'Executions'}
          </h2>
        </div>

        <ExecutionList
          executions={executionsData?.data || []}
          isLoading={isLoadingExecutions}
        />

        {/* Pagination */}
        {executionsData && executionsData.pagination.total > 0 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => handlePageChange((filters.page ?? 1) - 1)}
              disabled={filters.page === 1}
              className="px-4 py-2 text-sm font-medium rounded-md bg-muted text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-calm"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              <span className="px-3 py-2 text-sm text-muted-foreground">
                Page {filters.page} of{' '}
                {Math.ceil(
                  executionsData.pagination.total / (filters.limit ?? 20)
                )}
              </span>
            </div>
            <button
              onClick={() => handlePageChange((filters.page ?? 1) + 1)}
              disabled={!executionsData.pagination.hasMore}
              className="px-4 py-2 text-sm font-medium rounded-md bg-muted text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-calm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
