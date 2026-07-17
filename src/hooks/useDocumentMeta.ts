import { useLayoutEffect } from 'react'

export function useDocumentMeta(title: string, faviconHref: string) {
  useLayoutEffect(() => {
    const prevTitle = document.title
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
    const prevFavicon = link?.getAttribute('href') ?? ''

    document.title = title
    if (link) link.setAttribute('href', faviconHref)

    return () => {
      document.title = prevTitle
      if (link) link.setAttribute('href', prevFavicon)
    }
  }, [title, faviconHref])
}
