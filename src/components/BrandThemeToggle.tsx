import { Store } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type Size = 'sm' | 'md' | 'lg'

const boxClass: Record<Size, string> = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-16 w-16 rounded-2xl',
}

const iconClass: Record<Size, string> = {
  sm: 'h-5 w-5',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
}

export function BrandThemeToggle({
  size = 'md',
  className = '',
}: {
  size?: Size
  className?: string
}) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className={`relative flex shrink-0 items-center justify-center bg-teal-600 text-white shadow-sm transition hover:bg-teal-500 hover:ring-2 hover:ring-teal-400/40 active:scale-95 dark:bg-teal-500 dark:hover:bg-teal-400 dark:hover:ring-teal-300/30 ${boxClass[size]} ${className}`}
    >
      <Store className={iconClass[size]} />
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
          isDark ? 'bg-amber-400' : 'bg-slate-700'
        }`}
        aria-hidden
      />
    </button>
  )
}
