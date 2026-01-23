import React from 'react'

import { ConfidenceBadge } from './ConfidenceBadge'

type CampaignCardProps = {
  type: string
  title: string
  confidence: 'Green' | 'Yellow' | 'Red'
  audienceSize: string
  offer?: string
  why: string
  showDraftOnly?: boolean
}

export function CampaignCard({
  type,
  title,
  confidence,
  audienceSize,
  offer,
  why,
  showDraftOnly = false,
}: CampaignCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {type}
          </p>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <span className="font-medium text-gray-700">Audience:</span>
          <span className="ml-2">{audienceSize} customers</span>
        </div>
        {offer && (
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium text-gray-700">Offer:</span>
            <span className="ml-2">{offer}</span>
          </div>
        )}
        <div className="flex gap-1.5 my-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"
            >
              <div className="w-6 h-6 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 italic">&ldquo;{why}&rdquo;</p>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Preview
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${showDraftOnly ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' : 'text-white bg-teal-500 hover:bg-teal-600'}`}
        >
          {showDraftOnly ? 'Draft only' : 'Approve'}
        </button>
      </div>
    </div>
  )
}
