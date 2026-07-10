/**
 * Sube imágenes a Cloudinary (unsigned upload preset).
 * Ventajas vs Supabase Storage: CDN global, resize automático, optimización WebP.
 */
export async function uploadProductImage(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || cloudName === 'tu-cloud-name') {
    throw new Error('Configura VITE_CLOUDINARY_CLOUD_NAME en tu archivo .env')
  }
  if (!uploadPreset) {
    throw new Error('Configura VITE_CLOUDINARY_UPLOAD_PRESET en tu archivo .env')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'bodega/productos')

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Error al subir imagen')
  }

  const data = await res.json()
  return data.secure_url as string
}

export function getOptimizedImageUrl(url: string, width = 200): string {
  if (!url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/w_${width},c_limit,f_auto,q_auto/`)
}
