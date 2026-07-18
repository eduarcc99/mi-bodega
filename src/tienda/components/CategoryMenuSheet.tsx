import { X } from 'lucide-react'
import { useTiendaCatalog } from '@/tienda/context/TiendaCatalogContext'

export function CategoryMenuSheet() {
  const { menuOpen, setMenuOpen, categorias, categoria, setCategoria } = useTiendaCatalog()

  if (!menuOpen) return null

  function elegir(cat: string) {
    setCategoria(cat)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar menú"
        onClick={() => setMenuOpen(false)}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <h2 className="font-bold text-slate-900">Categorías</h2>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="tienda-btn rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => elegir('')}
            className={`tienda-btn mb-1 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
              !categoria
                ? 'bg-rose-900 text-white'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Todos los productos
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => elegir(c)}
              className={`tienda-btn mb-1 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                categoria === c
                  ? 'bg-rose-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {c}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
