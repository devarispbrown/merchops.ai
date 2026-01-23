/**
 * Queue Page Loading State
 * Displayed while opportunities are being fetched
 */

export default function QueueLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="border-b border-gray-200 pb-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="mt-2 h-4 w-96 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-4">
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Opportunity cards skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-lg p-6 space-y-3 animate-pulse"
          >
            {/* Priority badge */}
            <div className="h-6 w-20 bg-gray-200 rounded" />

            {/* Title */}
            <div className="h-6 w-64 bg-gray-300 rounded" />

            {/* Description lines */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-5/6 bg-gray-100 rounded" />
              <div className="h-4 w-4/6 bg-gray-100 rounded" />
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-9 w-24 bg-gray-300 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
