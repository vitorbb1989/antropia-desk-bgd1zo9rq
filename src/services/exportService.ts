import { format } from 'date-fns'

/** Sanitize a cell value to prevent CSV formula injection */
function sanitizeCell(value: any): string {
  if (value == null) return ''
  const str = String(value)
  // Prefix dangerous characters that could be interpreted as formulas
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  // Escape quotes and wrap in quotes if value contains comma, quote, or newline
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

export const exportService = {
  toCSV: (data: any[], headers: string[], keys: string[], filename: string) => {
    if (!data || !data.length) return

    const csvContent = [
      headers.map(sanitizeCell).join(','),
      ...data.map((item) =>
        keys.map((key) => sanitizeCell(item[key])).join(','),
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`,
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  print: () => {
    window.print()
  },
}
