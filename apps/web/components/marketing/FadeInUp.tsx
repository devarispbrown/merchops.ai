'use client'

import React from 'react'

import { useInView } from './useInView'

type FadeInUpProps = {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function FadeInUp({ children, delay = 0, className }: FadeInUpProps) {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold: 0.1, triggerOnce: true })

  const visibleStyle: React.CSSProperties = {
    opacity: 1,
    transform: 'translateY(0)',
    transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
  }

  const hiddenStyle: React.CSSProperties = {
    opacity: 0,
    transform: 'translateY(20px)',
    transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
  }

  return (
    <div ref={ref} style={isInView ? visibleStyle : hiddenStyle} className={className}>
      {children}
    </div>
  )
}
