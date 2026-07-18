import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CategoryScrollerProps {
  categorias: string[]
  categoria: string
  onSelect: (categoria: string) => void
}

export function CategoryScroller({ categorias, categoria, onSelect }: CategoryScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 6)
    setCanScrollRight(maxScroll > 6 && el.scrollLeft < maxScroll - 6)
  }, [])

  useEffect(() => {
    updateScrollHints()
    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver(updateScrollHints)
    observer.observe(el)
    return () => observer.disconnect()
  }, [categorias, updateScrollHints])

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  function pillClass(active: boolean) {
    return `shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold transition ${
      active
        ? 'bg-rose-900 text-white shadow-md ring-2 ring-rose-700/50'
        : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50'
    }`
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {canScrollLeft && (
          <>
            <div
              className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-rose-50 via-rose-50/95 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => scrollBy(-140)}
              className="absolute left-0 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200"
              aria-label="Ver categorías anteriores"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollHints}
          className="category-scroll flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]"
          style={{ scrollSnapType: 'x proximity' }}
        >
          <button type="button" onClick={() => onSelect('')} className={pillClass(!categoria)}>
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              className={pillClass(categoria === c)}
            >
              {c}
            </button>
          ))}
          <span className="w-2 shrink-0" aria-hidden />
        </div>

        {canScrollRight && (
          <>
            <div
              className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-rose-50 via-rose-50/95 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => scrollBy(140)}
              className="absolute right-0 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200"
              aria-label="Ver más categorías"
            >
              <ChevronRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </>
        )}
      </div>

      {(canScrollLeft || canScrollRight) && (
        <p className="text-center text-[10px] font-medium text-slate-400">
          Desliza horizontalmente para ver más categorías
        </p>
      )}
    </div>
  )
}
