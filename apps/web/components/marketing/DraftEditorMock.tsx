import React from 'react'

import { ConfidenceBadge } from './ConfidenceBadge'

type ProductPrice = {
  label: string
  color: string
}

const productPrices: ProductPrice[] = [
  { label: '$42', color: 'bg-rose-100 text-rose-600' },
  { label: '$28', color: 'bg-amber-100 text-amber-600' },
  { label: '$65', color: 'bg-orange-100 text-orange-600' },
]

export function DraftEditorMock() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Draft ready to review
        </p>
        <ConfidenceBadge confidence="Green" />
      </div>

      {/* Subject line */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-400 mb-1">Subject</p>
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-sm font-medium text-gray-800">
            We miss you — here&apos;s 15% off your next order
          </p>
        </div>
      </div>

      {/* Audience segment */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-400 mb-1">Audience</p>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-xs font-medium text-teal-700">
          90-day lapsers · 2,184 customers
        </span>
      </div>

      {/* Product picks */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-400 mb-2">Product picks</p>
        <div className="flex gap-2">
          {productPrices.map((product, index) => (
            <div
              key={index}
              className={`w-14 h-14 rounded-xl flex items-center justify-center font-semibold text-xs ${product.color}`}
            >
              {product.label}
            </div>
          ))}
        </div>
      </div>

      {/* Email body */}
      <div className="mb-5">
        <p className="text-xs font-medium text-gray-400 mb-1">Email body</p>
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 space-y-1.5">
          <p className="text-sm text-gray-700">Hey there,</p>
          <p className="text-sm text-gray-700">
            It&apos;s been a while — we&apos;ve added new styles we think you&apos;ll love.
            Use code <span className="font-semibold text-gray-900">WELCOME15</span> for
            15% off, just for you.
          </p>
          <p className="text-sm text-gray-500 italic">
            Offer valid for 7 days · Free shipping over $75
          </p>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex gap-2 pt-1">
        <button className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Dismiss
        </button>
        <button className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors">
          Approve &amp; Send
        </button>
      </div>
    </div>
  )
}
