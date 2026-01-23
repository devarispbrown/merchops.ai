'use client';

import { ExecutionStatus } from '@prisma/client';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface ExecutionFiltersProps {
  onFilterChange: (filters: {
    status?: ExecutionStatus | 'all';
    executionType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => void;
  currentFilters: {
    status?: ExecutionStatus | 'all';
    executionType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

const statusOptions: Array<{ value: ExecutionStatus | 'all'; label: string }> =
  [
    { value: 'all', label: 'All' },
    { value: 'succeeded', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
    { value: 'running', label: 'Running' },
  ];

const executionTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'discount_draft', label: 'Discount' },
  { value: 'winback_email_draft', label: 'Win-back Email' },
  { value: 'pause_product', label: 'Pause Product' },
];

export function ExecutionFilters({
  onFilterChange,
  currentFilters,
}: ExecutionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState(currentFilters);

  const handleStatusChange = (status: ExecutionStatus | 'all') => {
    const newFilters = { ...localFilters, status };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleExecutionTypeChange = (executionType: string) => {
    const newFilters = {
      ...localFilters,
      executionType: executionType === 'all' ? undefined : executionType,
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateFromChange = (dateStr: string) => {
    const newFilters = {
      ...localFilters,
      dateFrom: dateStr ? new Date(dateStr) : undefined,
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateToChange = (dateStr: string) => {
    const newFilters = {
      ...localFilters,
      dateTo: dateStr ? new Date(dateStr) : undefined,
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const newFilters = { status: 'all' as const };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const hasActiveFilters =
    (currentFilters.status && currentFilters.status !== 'all') ||
    currentFilters.executionType ||
    currentFilters.dateFrom ||
    currentFilters.dateTo;

  return (
    <div className="space-y-4">
      {/* Status Filter - Always Visible */}
      <div>
        <label htmlFor="status-filter" className="block text-sm font-medium text-foreground mb-2">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-calm ${
                (currentFilters.status || 'all') === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle Advanced Filters */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        {isExpanded ? (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
            Hide advanced filters
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            Show advanced filters
          </>
        )}
      </button>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-border">
          {/* Execution Type Filter */}
          <div>
            <label htmlFor="execution-type-filter" className="block text-sm font-medium text-foreground mb-2">
              Execution Type
            </label>
            <div className="flex flex-wrap gap-2">
              {executionTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleExecutionTypeChange(option.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-calm ${
                    (!currentFilters.executionType && option.value === 'all') ||
                    currentFilters.executionType === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="dateFrom"
                className="block text-sm font-medium text-foreground mb-2"
              >
                From Date
              </label>
              <Input
                id="dateFrom"
                type="date"
                value={
                  localFilters.dateFrom
                    ? localFilters.dateFrom.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="dateTo"
                className="block text-sm font-medium text-foreground mb-2"
              >
                To Date
              </label>
              <Input
                id="dateTo"
                type="date"
                value={
                  localFilters.dateTo
                    ? localFilters.dateTo.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
