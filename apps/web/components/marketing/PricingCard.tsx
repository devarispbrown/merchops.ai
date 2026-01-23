import { Check } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type PricingCardProps = {
  name: string
  price: string
  period?: string
  subtitle?: string
  features: string[]
  highlighted?: boolean
  ctaText: string
}

export function PricingCard({
  name,
  price,
  period = '/mo',
  subtitle,
  features,
  highlighted = false,
  ctaText,
}: PricingCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md p-8 flex flex-col ${highlighted ? 'border-2 border-teal-500 ring-4 ring-teal-50' : 'border border-gray-100'}`}
    >
      {highlighted && (
        <span className="inline-flex self-start px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full mb-4">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-semibold text-gray-900 mb-1">{name}</h3>
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      <div className="flex items-baseline mb-6">
        <span className="text-4xl font-bold text-gray-900">{price}</span>
        <span className="text-gray-500 ml-1">{period}</span>
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start text-sm text-gray-600">
            <Check className="w-5 h-5 text-teal-500 mr-2 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup?returnTo=/app"
        className={`w-full py-3 px-4 rounded-xl font-medium transition-colors text-center block ${highlighted ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
      >
        {ctaText}
      </Link>
    </div>
  )
}
