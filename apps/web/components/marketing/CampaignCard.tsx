import React from 'react'
import { ShoppingBag, Shirt, Package } from 'lucide-react'

import { ConfidenceBadge } from './ConfidenceBadge'

type ProductThumbnail = {
  name: string
  color: string
}

type CampaignCardProps = {
  type: string
  title: string
  confidence: 'Green' | 'Yellow' | 'Red'
  audienceSize: string
  offer?: string
  why: string
  showDraftOnly?: boolean
  products?: ProductThumbnail[]
}

const colorMap: Record<string, string> = {
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-600',
  orange: 'bg-orange-100 text-orange-600',
  sky: 'bg-sky-100 text-sky-600',
  violet: 'bg-violet-100 text-violet-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  slate: 'bg-slate-100 text-slate-600',
  stone: 'bg-stone-100 text-stone-500',
  zinc: 'bg-zinc-100 text-zinc-500',
}

function ProductThumbnailItem({ name, color }: ProductThumbnail) {
  const colorClass = colorMap[color] ?? 'bg-gray-100 text-gray-500'
  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-xs ${colorClass}`}
    >
      {name}
    </div>
  )
}

export function CampaignCard({
  type,
  title,
  confidence,
  audienceSize,
  offer,
  why,
  showDraftOnly = false,
  products,
}: CampaignCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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
          {products && products.length > 0 ? (
            products.map((product, index) => (
              <ProductThumbnailItem
                key={index}
                name={product.name}
                color={product.color}
              />
            ))
          ) : (
            <>
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-gray-500" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-teal-600" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
            </>
          )}
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
