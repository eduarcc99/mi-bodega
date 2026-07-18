interface CategorySidebarProps {
  categorias: string[]
  categoria: string
  onSelect: (categoria: string) => void
}

export function CategorySidebar({ categorias, categoria, onSelect }: CategorySidebarProps) {
  return (
    <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-60">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          Categoría
        </h2>
        <ul className="mt-3 space-y-2">
          <li>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input
                type="radio"
                name="categoria-sidebar"
                checked={!categoria}
                onChange={() => onSelect('')}
                className="h-4 w-4 border-slate-300 text-rose-900 focus:ring-rose-500"
              />
              Todos los productos
            </label>
          </li>
          {categorias.map((c) => (
            <li key={c}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="categoria-sidebar"
                  checked={categoria === c}
                  onChange={() => onSelect(c)}
                  className="h-4 w-4 border-slate-300 text-rose-900 focus:ring-rose-500"
                />
                {c}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
