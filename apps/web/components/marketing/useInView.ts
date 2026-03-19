'use client'

import { useEffect, useRef, useState } from 'react'

type UseInViewOptions = {
  threshold?: number
  triggerOnce?: boolean
}

export function useInView<T extends Element = HTMLDivElement>(
  options: UseInViewOptions = {}
): [React.RefObject<T>, boolean] {
  const { threshold = 0.1, triggerOnce = true } = options

  // Respect prefers-reduced-motion at hook initialisation time. When reduced
  // motion is preferred we initialise isInView as true so elements appear
  // immediately with no animation — no observer is attached.
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const ref = useRef<T>(null)
  const [isInView, setIsInView] = useState(prefersReducedMotion)

  useEffect(() => {
    // When reduced motion is preferred the initial state is already true,
    // so there is nothing to observe.
    if (prefersReducedMotion) return

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          setIsInView(true)
          if (triggerOnce) {
            observer.unobserve(element)
          }
        } else if (!triggerOnce) {
          setIsInView(false)
        }
      },
      { threshold }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [threshold, triggerOnce, prefersReducedMotion])

  return [ref, isInView]
}
