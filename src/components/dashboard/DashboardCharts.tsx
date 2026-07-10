import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatMoney } from '@/lib/utils'
import type { CategoriaVenta, GananciaProducto, TopProducto, VentaDiaria } from '@/lib/dashboard'

const COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1']

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
      {message}
    </div>
  )
}

export function TopProductosChart({ data }: { data: TopProducto[] }) {
  if (data.length === 0) return <ChartEmpty message="Sin ventas en este período" />

  const chartData = data.map((p) => ({
    name: p.nombre.length > 18 ? p.nombre.slice(0, 16) + '…' : p.nombre,
    cantidad: p.cantidad,
    monto: p.monto,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === 'monto' ? formatMoney(value) : value
          }
        />
        <Bar dataKey="cantidad" fill="#0d9488" name="Unidades" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoriasPieChart({ data }: { data: CategoriaVenta[] }) {
  if (data.length === 0) return <ChartEmpty message="Sin ventas por categoría" />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="monto"
          nameKey="nombre"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ nombre, porcentaje }) => `${nombre} ${porcentaje}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => formatMoney(v)} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function GananciaChart({ data }: { data: GananciaProducto[] }) {
  if (data.length === 0) return <ChartEmpty message="Sin datos de ganancia" />

  const chartData = data.map((p) => ({
    name: p.nombre.length > 14 ? p.nombre.slice(0, 12) + '…' : p.nombre,
    ganancia: p.ganancia,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `S/${v}`} />
        <Tooltip formatter={(v: number) => formatMoney(v)} />
        <Bar dataKey="ganancia" fill="#10b981" name="Ganancia" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function VentasLineChart({ data }: { data: VentaDiaria[] }) {
  if (data.length === 0) return <ChartEmpty message="Sin evolución de ventas" />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `S/${v}`} />
        <Tooltip formatter={(v: number) => formatMoney(v)} />
        <Legend />
        <Line type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} name="Ventas" />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function VencimientosChart({
  data,
}: {
  data: { nombre: string; valorPerdida: number; estado: string }[]
}) {
  if (data.length === 0) return <ChartEmpty message="No hay productos vencidos o por vencer" />

  const chartData = data.slice(0, 8).map((p) => ({
    name: p.nombre.length > 14 ? p.nombre.slice(0, 12) + '…' : p.nombre,
    valor: p.valorPerdida,
    fill: p.estado === 'vencido' ? '#ef4444' : '#f59e0b',
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `S/${v}`} />
        <Tooltip formatter={(v: number) => formatMoney(v)} labelFormatter={(l) => l} />
        <Bar dataKey="valor" name="Valor en riesgo" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
