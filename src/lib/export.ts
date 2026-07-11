import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import type { ReporteData } from '@/lib/reportes'
import { todayLocalISO } from '@/lib/utils'

function nombreArchivo(titulo: string, ext: string): string {
  const slug = titulo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  const fecha = todayLocalISO()
  return `bodega_${slug}_${fecha}.${ext}`
}

function filasComoArrays(reporte: ReporteData): (string | number)[][] {
  return reporte.filas.map((fila) =>
    reporte.columnas.map((col) => {
      const val = fila[col.key]
      return val ?? ''
    }),
  )
}

export function exportarPDF(reporte: ReporteData): void {
  const doc = new jsPDF({ orientation: reporte.columnas.length > 6 ? 'landscape' : 'portrait' })
  const headers = reporte.columnas.map((c) => c.label)
  const body = filasComoArrays(reporte)

  doc.setFontSize(14)
  doc.text('MI BODEGA', 14, 16)
  doc.setFontSize(11)
  doc.text(reporte.titulo, 14, 24)
  doc.setFontSize(9)
  doc.text(`Generado: ${new Date().toLocaleString('es-PE')}`, 14, 30)

  autoTable(doc, {
    head: [headers],
    body,
    startY: 36,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 36

  if (reporte.totales?.label) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(String(reporte.totales.label), 14, finalY + 8)
  }

  doc.save(nombreArchivo(reporte.titulo, 'pdf'))
}

export async function exportarExcel(reporte: ReporteData): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Reporte')

  ws.mergeCells(1, 1, 1, reporte.columnas.length)
  ws.getCell(1, 1).value = 'MI BODEGA — ' + reporte.titulo
  ws.getCell(1, 1).font = { bold: true, size: 12 }

  ws.mergeCells(2, 1, 2, reporte.columnas.length)
  ws.getCell(2, 1).value = `Generado: ${new Date().toLocaleString('es-PE')}`
  ws.getCell(2, 1).font = { size: 9, color: { argb: '666666' } }

  const headerRow = ws.addRow(reporte.columnas.map((c) => c.label))
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0D9488' } }
  })

  for (const fila of reporte.filas) {
    ws.addRow(reporte.columnas.map((col) => fila[col.key] ?? ''))
  }

  if (reporte.totales?.label) {
    ws.addRow([])
    const totalRow = ws.addRow([String(reporte.totales.label)])
    totalRow.font = { bold: true }
  }

  reporte.columnas.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(col.label.length + 4, 14)
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(reporte.titulo, 'xlsx')
  a.click()
  URL.revokeObjectURL(url)
}
