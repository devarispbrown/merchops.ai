'use client';

export function SyncInProgress() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Analyzing your store data
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        We&apos;re syncing your products, orders, and customer data to find opportunities.
        This usually takes 2-5 minutes.
      </p>
      <div className="mt-6 flex justify-center gap-1">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }} />
      </div>
    </div>
  );
}
