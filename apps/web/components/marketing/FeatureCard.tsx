import { LucideIcon } from 'lucide-react'
import React from 'react'

type FeatureCardProps = {
  icon: LucideIcon
  title: string
  description: string
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-teal-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}
