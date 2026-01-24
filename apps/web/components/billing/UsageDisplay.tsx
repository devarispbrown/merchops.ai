'use client';

import { cn } from '@/lib/utils';

export interface UsageDisplayProps {
  metric: string;
  used: number;
  limit: number;
  isUnlimited?: boolean;
}

export function UsageDisplay({
  metric,
  used,
  limit,
  isUnlimited = false,
}: UsageDisplayProps) {
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);

  const getColorClass = () => {
    if (isUnlimited) return 'bg-teal-500';
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-teal-500';
  };

  const getTextColorClass = () => {
    if (isUnlimited) return 'text-teal-700';
    if (percentage >= 80) return 'text-red-700';
    if (percentage >= 60) return 'text-yellow-700';
    return 'text-teal-700';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{metric}</span>
        <span className={cn('font-medium', getTextColorClass())}>
          {isUnlimited ? (
            'Unlimited'
          ) : (
            <>
              {used.toLocaleString()} / {limit.toLocaleString()}
            </>
          )}
        </span>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', getColorClass())}
          style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
        />
      </div>

      {!isUnlimited && percentage > 0 && (
        <p className="text-xs text-muted-foreground">
          {percentage.toFixed(0)}% used
        </p>
      )}
    </div>
  );
}
