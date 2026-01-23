/**
 * Settings Page Loading State
 * Displayed while settings data is being fetched
 */

export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="border-b border-gray-200 pb-4">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="mt-2 h-4 w-72 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Settings sections skeleton */}
      <div className="space-y-6">
        {/* Section 1: Workspace */}
        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="h-6 w-48 bg-gray-300 rounded animate-pulse" />
          <div className="space-y-3">
            <div>
              <div className="h-4 w-32 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            </div>
            <div>
              <div className="h-4 w-40 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Section 2: Shopify Connection */}
        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="h-6 w-56 bg-gray-300 rounded animate-pulse" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-gray-300 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Section 3: Preferences */}
        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="h-6 w-40 bg-gray-300 rounded animate-pulse" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-4 w-56 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-72 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-12 bg-gray-300 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-12 bg-gray-300 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="flex gap-3 pt-6 border-t border-gray-200">
        <div className="h-10 w-32 bg-gray-300 rounded animate-pulse" />
        <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
