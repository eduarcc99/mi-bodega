import html2canvas from 'html2canvas-pro'

/** Escala alta para texto nítido al compartir (WhatsApp, etc.) */
const ESCALA_CAPTURA = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3)

export async function capturarElementoComoPng(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: ESCALA_CAPTURA,
    logging: false,
    useCORS: true,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo crear la imagen del ticket'))
      },
      'image/png',
    )
  })
}

function puedeCompartirArchivo(file: File): boolean {
  return typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

/** Captura el ticket como PNG nítido y abre compartir (WhatsApp en celular) o descarga en PC */
export async function compartirTicketImagen(
  element: HTMLElement,
  nombreArchivo: string,
): Promise<'shared' | 'downloaded'> {
  const blob = await capturarElementoComoPng(element)
  const file = new File([blob], nombreArchivo, { type: 'image/png' })

  if (puedeCompartirArchivo(file)) {
    try {
      await navigator.share({
        files: [file],
        title: 'Ticket MI BODEGA',
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Compartir cancelado')
      }
      throw err
    }
  }

  descargarBlob(blob, nombreArchivo)
  return 'downloaded'
}
