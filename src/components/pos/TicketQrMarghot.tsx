import { useEffect, useState } from 'react'
import { urlTiendaMarghot } from '@/lib/ticketBranding'

interface TicketQrMarghotProps {
  className?: string
  size?: number
}

/** QR hacia la web MARGHOT — se genera al montar para no inflar el bundle inicial */
export function TicketQrMarghot({ className = '', size = 72 }: TicketQrMarghotProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    void import('qrcode').then((QR) =>
      QR.toDataURL(urlTiendaMarghot(), {
        width: size * 2,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }),
    ).then((dataUrl) => {
      if (!cancelado) setSrc(dataUrl)
    })
    return () => {
      cancelado = true
    }
  }, [size])

  if (!src) {
    return (
      <div
        className={`rounded border border-slate-200 bg-white ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    <img
      src={src}
      alt="QR MARGHOT — pedidos web"
      width={size}
      height={size}
      className={`rounded border border-slate-200 bg-white ${className}`}
    />
  )
}
