import { useEffect, useRef, useState } from 'react'

interface CartBadgeProps {
  count: number
  className?: string
}

/** Badge del carrito con animación pop al aumentar la cantidad */
export function CartBadge({ count, className = '' }: CartBadgeProps) {
  const [pop, setPop] = useState(false)
  const prevCount = useRef(count)

  useEffect(() => {
    if (count > prevCount.current) {
      setPop(true)
      const timer = window.setTimeout(() => setPop(false), 480)
      prevCount.current = count
      return () => window.clearTimeout(timer)
    }
    prevCount.current = count
  }, [count])

  if (count <= 0) return null

  return (
    <span
      className={`flex items-center justify-center rounded-full bg-amber-400 font-black text-rose-950 ${
        pop ? 'cart-badge-pop' : ''
      } ${className}`}
    >
      {Math.round(count)}
    </span>
  )
}
