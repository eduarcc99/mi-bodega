import { TIENDA_CONFIG } from '@/tienda/config'

/** 0=Dom, 1=Lun, …, 6=Sáb */
function diaSemana(now: Date): number {
  return now.getDay()
}

function horaActual(now: Date): number {
  return now.getHours()
}

function enHorarioSemana(hora: number): boolean {
  return hora >= TIENDA_CONFIG.horaApertura && hora < TIENDA_CONFIG.horaCierre
}

export function isTiendaAbierta(now = new Date()): boolean {
  if (import.meta.env.VITE_TIENDA_DEV_ABIERTA === 'true') return true

  const dia = diaSemana(now)
  const hora = horaActual(now)

  if (dia === 0) return false // Domingo cerrado
  if (dia === 6) return true // Sábado 24 horas
  if (dia >= 1 && dia <= 5) return enHorarioSemana(hora) // Lun–Vie 7–11 PM

  return false
}

export function mensajeHorario(): string {
  return 'Lun–Vie: 7:00 PM – 11:00 PM · Sáb: 24 horas · Dom: cerrado'
}

/** Texto corto del horario de hoy (para el header) */
export function mensajeHorarioHoy(now = new Date()): string {
  const dia = diaSemana(now)
  if (dia === 6) return 'Hoy sábado · 24 horas'
  if (dia === 0) return 'Domingo cerrado'
  return '7:00 PM – 11:00 PM'
}

export function proximaApertura(now = new Date()): string {
  const dia = diaSemana(now)
  const hora = horaActual(now)

  if (dia === 0) return 'Domingo cerrado · Abrimos el lunes a las 7:00 PM'

  if (dia >= 1 && dia <= 5) {
    if (hora < TIENDA_CONFIG.horaApertura) {
      return 'Volvemos hoy a las 7:00 PM'
    }
    if (hora >= TIENDA_CONFIG.horaCierre) {
      if (dia === 5) return 'Abrimos mañana sábado (24 horas)'
      return 'Volvemos mañana a las 7:00 PM'
    }
  }

  return mensajeHorario()
}
