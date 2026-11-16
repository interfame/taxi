// Socket de navegador hacia el fleet service - singleton en cliente
import { io, type Socket } from 'socket.io-client'

// URL del servicio de flota:
// - Por defecto (sandbox) se usa '/?XTransformPort=3003' para que Caddy reenvie al 3003.
// - En producción serverless (Vercel) se puede definir NEXT_PUBLIC_FLEET_SOCKET_URL.
//   Si se define como cadena vacía (''), el socket queda deshabilitado y la app
//   funciona por sondeo HTTP (/api/fleet/sync).
const RAW_URL = process.env.NEXT_PUBLIC_FLEET_SOCKET_URL
export const FLEET_SOCKET_URL = RAW_URL === undefined ? '/?XTransformPort=3003' : RAW_URL

/** true si el socket de flota está deshabilitado (solo sondeo HTTP). */
export function fleetSocketDisabled(): boolean {
  return FLEET_SOCKET_URL === ''
}

const globalForSocket = globalThis as unknown as {
  __fleetBrowserSocket?: Socket
}

export function getFleetSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('getFleetSocket solo puede usarse en el navegador')
  }
  if (fleetSocketDisabled()) {
    throw new Error('El socket de flota está deshabilitado (modo sondeo HTTP)')
  }
  if (!globalForSocket.__fleetBrowserSocket) {
    globalForSocket.__fleetBrowserSocket = io(FLEET_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
  }
  return globalForSocket.__fleetBrowserSocket
}

/**
 * Emite un evento al fleet service si el socket está disponible.
 * En modo sondeo HTTP (socket deshabilitado) es un no-op seguro.
 */
export function emitFleet(event: string, data?: unknown): void {
  try {
    getFleetSocket().emit(event, data)
  } catch {
    // socket deshabilitado o no disponible: la presencia se maneja por HTTP
  }
}
