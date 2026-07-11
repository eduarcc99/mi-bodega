import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode'

const SCANNER_ID = 'pos-camera-scanner'

const FORMATOS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
]

interface CameraScannerModalProps {
  onScan: (code: string) => void
  onClose: () => void
}

export function CameraScannerModal({ onScan, onClose }: CameraScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(SCANNER_ID, {
      formatsToSupport: FORMATOS,
      verbose: false,
    })
    scannerRef.current = scanner

    async function start() {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cancelled) return

        if (cameras.length === 0) {
          setError('No se encontró cámara en este dispositivo.')
          setStarting(false)
          return
        }

        const rear =
          cameras.find((c) => /back|rear|trase|environment/i.test(c.label)) ??
          cameras[cameras.length - 1]

        await scanner.start(
          rear.id,
          { fps: 10, qrbox: { width: 260, height: 160 }, aspectRatio: 1 },
          (decoded) => {
            if (scannedRef.current) return
            scannedRef.current = true
            onScan(decoded.trim())
          },
          () => {},
        )

        if (!cancelled) setStarting(false)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo abrir la cámara. Usa HTTPS o localhost.',
          )
          setStarting(false)
        }
      }
    }

    start()

    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      if (s?.isScanning) {
        s.stop().catch(() => {})
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-teal-600" />
            <h3 className="font-bold text-slate-900">Escanear código</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-center text-sm text-slate-500">
            Apunta a un código QR o de barras del producto
          </p>

          <div className="relative overflow-hidden rounded-xl bg-slate-900">
            <div id={SCANNER_ID} className="min-h-[240px] w-full [&_video]:rounded-xl" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            En PC sigue funcionando el lector de barras USB en el campo de búsqueda
          </p>
        </div>
      </div>
    </div>
  )
}
