import { Construction } from 'lucide-react'

interface PlaceholderProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-24 text-center">
      <Construction className="mb-4 h-12 w-12 text-slate-300" />
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-slate-500">{description}</p>
      <p className="mt-4 text-sm text-teal-600">Próximamente en V1.0</p>
    </div>
  )
}
