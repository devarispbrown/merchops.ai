'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PayloadPreviewProps {
  payload: Record<string, unknown>;
  title?: string;
  description?: string;
}

export function PayloadPreview({
  payload,
  title = 'Payload Preview',
  description = 'Full execution payload that will be sent',
}: PayloadPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </>
            )}
          </Button>
        </div>

        <PayloadTree data={payload} />
      </div>
    </Card>
  );
}

interface PayloadTreeProps {
  data: unknown;
  level?: number;
}

function PayloadTree({ data, level = 0 }: PayloadTreeProps) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof data === 'boolean') {
    return (
      <span className="text-primary font-medium">
        {data ? 'true' : 'false'}
      </span>
    );
  }

  if (typeof data === 'number') {
    return <span className="text-success font-medium">{data}</span>;
  }

  if (typeof data === 'string') {
    return <span className="text-foreground">&quot;{data}&quot;</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground">[]</span>;
    }

    return (
      <div className="space-y-1">
        <span className="text-muted-foreground">[</span>
        {data.map((item, index) => (
          <div
            key={index}
            className="pl-4 border-l-2 border-border"
            style={{ marginLeft: `${level * 8}px` }}
          >
            <PayloadTree data={item} level={level + 1} />
            {index < data.length - 1 && (
              <span className="text-muted-foreground">,</span>
            )}
          </div>
        ))}
        <span className="text-muted-foreground">]</span>
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return <span className="text-muted-foreground">{'{}'}</span>;
    }

    return (
      <div className="space-y-2">
        {entries.map(([key, value], index) => (
          <CollapsibleField
            key={key}
            fieldKey={key}
            value={value}
            level={level}
            isLast={index === entries.length - 1}
          />
        ))}
      </div>
    );
  }

  return <span className="text-muted-foreground">unknown</span>;
}

interface CollapsibleFieldProps {
  fieldKey: string;
  value: unknown;
  level: number;
  isLast: boolean;
}

function CollapsibleField({
  fieldKey,
  value,
  level,
  isLast,
}: CollapsibleFieldProps) {
  const [isOpen, setIsOpen] = useState(true);

  const isExpandable =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.keys(value).length > 0
      : Array.isArray(value) && value.length > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        {isExpandable && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="mt-1 text-muted-foreground hover:text-foreground transition-calm"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        <div className="flex-1 font-mono text-sm">
          <span className="text-warning font-medium">{fieldKey}</span>
          <span className="text-muted-foreground">: </span>
          {!isExpandable ? (
            <>
              <PayloadTree data={value} level={level + 1} />
              {!isLast && <span className="text-muted-foreground">,</span>}
            </>
          ) : (
            <>
              {typeof value === 'object' && !Array.isArray(value) && (
                <span className="text-muted-foreground">{'{'}</span>
              )}
              {Array.isArray(value) && (
                <span className="text-muted-foreground">[</span>
              )}
            </>
          )}
        </div>
      </div>

      {isExpandable && isOpen && (
        <div className="pl-6 border-l-2 border-border ml-1.5">
          <PayloadTree data={value} level={level + 1} />
        </div>
      )}

      {isExpandable && isOpen && (
        <div className="font-mono text-sm">
          {typeof value === 'object' && !Array.isArray(value) && (
            <span className="text-muted-foreground">{'}'}</span>
          )}
          {Array.isArray(value) && (
            <span className="text-muted-foreground">]</span>
          )}
          {!isLast && <span className="text-muted-foreground">,</span>}
        </div>
      )}
    </div>
  );
}
