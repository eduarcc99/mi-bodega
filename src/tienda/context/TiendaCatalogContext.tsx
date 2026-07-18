import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface TiendaCatalogContextValue {
  busqueda: string
  setBusqueda: (v: string) => void
  categoria: string
  setCategoria: (v: string) => void
  categorias: string[]
  setCategorias: (cats: string[]) => void
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  /** Header compacto (hamburguesa + búsqueda) visible al hacer scroll en catálogo */
  headerCompact: boolean
}

const TiendaCatalogContext = createContext<TiendaCatalogContextValue | null>(null)

const SCROLL_COMPACT_ENTER = 160
const SCROLL_COMPACT_RELEASE = 90

export function TiendaCatalogProvider({
  children,
  enCatalogo,
}: {
  children: ReactNode
  enCatalogo: boolean
}) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerCompact, setHeaderCompact] = useState(false)

  useEffect(() => {
    if (!enCatalogo) {
      setHeaderCompact(false)
      setMenuOpen(false)
      return
    }

    function onScroll() {
      if (window.innerWidth >= 1024) {
        setHeaderCompact(false)
        return
      }
      const y = window.scrollY
      setHeaderCompact((prev) => (prev ? y > SCROLL_COMPACT_RELEASE : y > SCROLL_COMPACT_ENTER))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enCatalogo])

  const value = useMemo(
    () => ({
      busqueda,
      setBusqueda,
      categoria,
      setCategoria,
      categorias,
      setCategorias,
      menuOpen,
      setMenuOpen,
      headerCompact,
    }),
    [busqueda, categoria, categorias, menuOpen, headerCompact],
  )

  return (
    <TiendaCatalogContext.Provider value={value}>{children}</TiendaCatalogContext.Provider>
  )
}

export function useTiendaCatalog() {
  const ctx = useContext(TiendaCatalogContext)
  if (!ctx) throw new Error('useTiendaCatalog debe usarse dentro de TiendaCatalogProvider')
  return ctx
}

/** Opcional: catálogo solo en página principal */
export function useTiendaCatalogOptional() {
  return useContext(TiendaCatalogContext)
}
