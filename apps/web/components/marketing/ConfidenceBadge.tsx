import React from 'react'

type ConfidenceLevel = 'Green' | 'Yellow' | 'Red'

type ConfidenceBadgeProps = {
  confidence: ConfidenceLevel
}

const badgeStyles: Record<ConfidenceLevel, string> = {
  Green: 'bg-green-100 text-green-800',
  Yellow: 'bg-amber-100 text-amber-800',
  Red: 'bg-red-100 text-red-800',
}

const badgeLabels: Record<ConfidenceLevel, string> = {
  Green: 'Ready to send',
  Yellow: 'Review suggested',
  Red: 'Needs review',
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[confidence]}`}
    >
      {badgeLabels[confidence]}
    </span>
  )
}
