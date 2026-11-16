// Socket de navegador hacia el fleet service - singleton en cliente
import { io, type Socket } from 'socket.io-client'

const globalForSocket = globalThis as unknown as {
  __fleetBrowserSocket?: Socket
}

export function getFleetSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('getFleetSocket solo puede usarse en el navegador')
  }
  if (!globalForSocket.__fleetBrowserSocket) {
    // Nunca usar el puerto en la URL: se usa XTransformPort para que Caddy reenvie al 3003
    globalForSocket.__fleetBrowserSocket = io('/?XTransformPort=3003', {
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
