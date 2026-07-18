/** Skeleton de la grilla de productos mientras carga el catálogo */
export function TiendaCatalogSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando productos">
      <div className="skeleton-shimmer h-12 rounded-full lg:hidden" />

      <div className="flex gap-2 overflow-hidden lg:hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-shimmer h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="lg:flex lg:gap-8">
        <div className="skeleton-shimmer hidden h-64 w-56 shrink-0 rounded-lg lg:block" />

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductoCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductoCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="skeleton-shimmer aspect-[4/3]" />
      <div className="space-y-2 p-3">
        <div className="skeleton-shimmer h-3 w-14 rounded-sm" />
        <div className="skeleton-shimmer h-3 w-16 rounded" />
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-3 w-20 rounded" />
        <div className="skeleton-shimmer h-6 w-24 rounded" />
        <div className="flex justify-end pt-1">
          <div className="skeleton-shimmer h-10 w-10 rounded-full" />
        </div>
      </div>
    </article>
  )
}

/** Skeleton mientras carga la imagen de un producto */
export function ProductoImagenSkeleton({
  className = '',
  light = false,
}: {
  className?: string
  light?: boolean
}) {
  return (
    <div
      className={`${light ? 'skeleton-shimmer' : 'skeleton-shimmer-dark'} ${className}`}
      aria-hidden
    />
  )
}
