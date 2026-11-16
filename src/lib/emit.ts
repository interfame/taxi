// Relay de eventos hacia el servicio de flota (puerto 3003) - SOLO servidor
import { io, type Socket } from 'socket.io-client'

const globalForFleet = globalThis as unknown as {
  __fleetRelaySocket?: Socket
}

function getRelaySocket(): Socket {
  if (!globalForFleet.__fleetRelaySocket) {
    const socket = io('http://localhost:3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 8000,
    })
    socket.on('connect_error', (err) => {
      console.error('[fleet-relay] error de conexion:', err.message)
    })
    socket.on('connect', () => {
      console.log('[fleet-relay] conectado al fleet service')
    })
    globalForFleet.__fleetRelaySocket = socket
  }
  return globalForFleet.__fleetRelaySocket
}

/**
 * Emite un evento a todos los clientes conectados a través del fleet service.
 * El socket.io-client bufferiza hasta que la conexion esté establecida.
 */
export function relayToFleet(event: string, data: Record<string, unknown>): void {
  try {
    getRelaySocket().emit('relay', { event, data })
  } catch (err) {
    console.error('[fleet-relay] fallo al emitir', event, err)
  }
}
