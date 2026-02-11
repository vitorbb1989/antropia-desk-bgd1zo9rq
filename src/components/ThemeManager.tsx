import { useEffect } from 'react'
import useSettingsStore from '@/stores/useSettingsStore'
import { hexToHSL } from '@/lib/utils'

export function ThemeManager() {
  const { settings } = useSettingsStore()

  useEffect(() => {
    const { primaryColor } = settings.branding
    if (primaryColor) {
      const hsl = hexToHSL(primaryColor)
      document.documentElement.style.setProperty('--primary', hsl)
      document.documentElement.style.setProperty('--ring', hsl)
      document.documentElement.style.setProperty('--sidebar-primary', hsl)
      document.documentElement.style.setProperty('--sidebar-ring', hsl)
    }
  }, [settings.branding.primaryColor])

  // Apply Favicon and Title logic could go here, or simple DOM manipulation
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (link && settings.branding.faviconUrl) {
      link.href = settings.branding.faviconUrl
    }
  }, [settings.branding.faviconUrl])

  return null
}
