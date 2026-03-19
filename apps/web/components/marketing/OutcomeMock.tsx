import React from 'react'

type MetricItem = {
  label: string
  value: string
}

const metrics: MetricItem[] = [
  { label: 'Sent', value: '2,184' },
  { label: 'Opened', value: '547 (25%)' },
  { label: 'Clicked', value: '89 (4%)' },
  { label: 'Converted', value: '12' },
]

export function OutcomeMock() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Campaign outcome
          </p>
          <h4 className="text-sm font-semibold text-gray-900">
            Winback Campaign — 90-day lapsers
          </h4>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Helped
        </span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center"
          >
            <p className="text-xs text-gray-500 mb-0.5">{metric.label}</p>
            <p className="text-sm font-semibold text-gray-800">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue line */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <p className="text-sm font-semibold text-green-700">
          +$1,847 attributed revenue
        </p>
      </div>

      {/* Confidence indicator */}
      <div className="bg-teal-50 rounded-xl px-4 py-3 border border-teal-100 mb-3">
        <p className="text-xs text-teal-800 leading-relaxed">
          <span className="font-semibold">Intent:</span> Re-engage dormant customers
          &nbsp;&middot;&nbsp;
          <span className="font-semibold">Confidence:</span> 78%
          <span className="text-green-600 font-medium"> ↑ trending up</span>
        </p>
      </div>

      {/* Evidence footer */}
      <p className="text-xs text-gray-400 leading-relaxed">
        Evidence: Based on 14-day observation window vs 30-day baseline
      </p>
    </div>
  )
}
