/**
 * RUSHTAXI - Servicio de flota en tiempo real (puerto 3003)
 *
 * - Presencia de chóferes (conectado / desconectado)
 * - GPS simulado: cada móvil conectado se mueve dentro de la zona demarcada.
 *   Si el cliente del chófer reporta GPS real (gps:update), se respeta esa posición.
 * - Reenvío de eventos del backend Next.js (pedidos, asignaciones, pagos).
 *
 * Eventos servidor -> clientes:
 *   positions        { ts, vehicles: VehiclePos[] }
 *   vehicle:online   { vehicleNumber, driverName }
 *   vehicle:offline  { vehicleNumber }
 *   trip:new         { trip }
 *   trip:assigned    { trip, vehicleNumber, pickup, dest }
 *   trip:ack         { tripId, vehicleNumber }
 *   trip:status      { tripId, status, vehicleNumber }
 *   trip:completed   { trip, payment, vehicleNumber }
 *   trip:cancelled   { tripId, vehicleNumber }
 *
 * Eventos clientes -> servidor:
 *   state:get        (ack) -> { ts, vehicles }
 *   driver:online    { vehicleNumber, driverName }
 *   driver:offline   { vehicleNumber }
 *   gps:update       { vehicleNumber, lat, lng, heading }
 *   trip:ack         { tripId, vehicleNumber }        (panel del chófer)
 *   relay            { event, data }                  (backend Next.js)
 */
import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

// Zona demarcada: un círculo de ~2.2 km sobre el Obelisco (CABA)
const CENTER = { lat: -34.6037, lng: -58.3816 }
const ZONE_RADIUS = 0.02 // grados

type Phase = 'idle' | 'to_pickup' | 'wait' | 'to_dest'

interface VehicleSim {
  number: number
  lat: number
  lng: number
  heading: number
  online: boolean
  realGps: boolean
  phase: Phase
  target: { lat: number; lng: number } | null
  tripId: string | null
}

interface VehiclePos {
  number: number
  lat: number
  lng: number
  heading: number
  online: boolean
  phase: Phase
  busy: boolean
}

const vehicles = new Map<number, VehicleSim>()
const socketsByVehicle = new Map<number, Set<string>>()

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomPointInZone(): { lat: number; lng: number } {
  const ang = rand(0, Math.PI * 2)
  const r = rand(0.002, ZONE_RADIUS * 0.75)
  return {
    lat: CENTER.lat + r * Math.sin(ang),
    lng: CENTER.lng + r * Math.cos(ang),
  }
}

// Punto determinista a partir de una dirección (para el destino simulado del pedido)
function pointFromSeed(seed: string): { lat: number; lng: number } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const ang = (h % 360) * (Math.PI / 180)
  const r = (((h >> 9) % 1000) / 1000) * (ZONE_RADIUS * 0.7) + 0.002
  return {
    lat: CENTER.lat + r * Math.sin(ang),
    lng: CENTER.lng + r * Math.cos(ang),
  }
}

function ensureVehicle(n: number): VehicleSim {
  let v = vehicles.get(n)
  if (!v) {
    const p = randomPointInZone()
    v = {
      number: n,
      lat: p.lat,
      lng: p.lng,
      heading: rand(0, Math.PI * 2),
      online: false,
      realGps: false,
      phase: 'idle',
      target: null,
      tripId: null,
    }
    vehicles.set(n, v)
  }
  return v
}

function snapshot(): VehiclePos[] {
  const out: VehiclePos[] = []
  for (const v of vehicles.values()) {
    out.push({
      number: v.number,
      lat: round6(v.lat),
      lng: round6(v.lng),
      heading: Math.round((v.heading * 180) / Math.PI),
      online: v.online,
      phase: v.phase,
      busy: v.phase !== 'idle',
    })
  }
  return out
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng)
}

function setPhase(v: VehicleSim, phase: Phase, target: { lat: number; lng: number } | null, tripId: string | null) {
  v.phase = phase
  v.target = target
  v.tripId = tripId
}

// Movimiento simulado de la flota
setInterval(() => {
  const STEP_TRAVEL = 0.00045 // hacia el pedido (~80 km/h)
  const STEP_IDLE = 0.00018 // deriva al quedar libre
  let changed = false

  for (const v of vehicles.values()) {
    if (!v.online || v.realGps) continue

    if (v.target && (v.phase === 'to_pickup' || v.phase === 'to_dest')) {
      const d = dist(v, v.target)
      if (d < 0.00035) {
        // llegó: si iba al pasajero queda esperando, si terminó queda libre
        setPhase(v, v.phase === 'to_pickup' ? 'wait' : 'idle', null, v.phase === 'to_pickup' ? v.tripId : null)
        changed = true
      } else {
        const k = Math.min(1, STEP_TRAVEL / d)
        v.heading = Math.atan2(v.target.lat - v.lat, v.target.lng - v.lng)
        v.lat += (v.target.lat - v.lat) * k
        v.lng += (v.target.lng - v.lng) * k
        changed = true
      }
    } else if (v.phase === 'idle') {
      // deriva aleatoria dentro de la zona
      v.heading += rand(-0.55, 0.55)
      let lat = v.lat + Math.cos(v.heading) * STEP_IDLE
      let lng = v.lng + Math.sin(v.heading) * STEP_IDLE
      const dCenter = Math.hypot(lat - CENTER.lat, lng - CENTER.lng)
      if (dCenter > ZONE_RADIUS * 0.82) {
        v.heading = Math.atan2(CENTER.lat - v.lat, CENTER.lng - v.lng)
        lat = v.lat + Math.cos(v.heading) * STEP_IDLE
        lng = v.lng + Math.sin(v.heading) * STEP_IDLE
      }
      v.lat = lat
      v.lng = lng
      changed = true
    }
    // 'wait': detenido en el punto del pasajero
  }

  if (changed || true) {
    io.emit('positions', { ts: Date.now(), vehicles: snapshot() })
  }
}, 2000)

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('RUSHTAXI fleet service')
})

const io = new Server(httpServer, {
  // NO cambiar el path: lo usa Caddy para reenviar al puerto correcto
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

function setVehicleOnline(socketId: string, vehicleNumber: number, driverName?: string) {
  const v = ensureVehicle(vehicleNumber)
  let set = socketsByVehicle.get(vehicleNumber)
  if (!set) {
    set = new Set()
    socketsByVehicle.set(vehicleNumber, set)
  }
  const wasOffline = !v.online
  set.add(socketId)
  v.online = true
  if (wasOffline) {
    io.emit('vehicle:online', { vehicleNumber, driverName: driverName ?? null, ts: Date.now() })
    console.log(`Movil ${vehicleNumber} conectado (${driverName ?? 'chofer'})`)
  }
}

function setVehicleOffline(vehicleNumber: number) {
  const v = ensureVehicle(vehicleNumber)
  const wasOnline = v.online
  socketsByVehicle.delete(vehicleNumber)
  v.online = false
  setPhase(v, 'idle', null, null)
  if (wasOnline) {
    io.emit('vehicle:offline', { vehicleNumber, ts: Date.now() })
    console.log(`Movil ${vehicleNumber} desconectado`)
  }
}

io.on('connection', (socket) => {
  console.log(`Conexion: ${socket.id}`)

  socket.on('state:get', (_payload: unknown, ack?: (data: unknown) => void) => {
    if (typeof ack === 'function') {
      ack({ ts: Date.now(), vehicles: snapshot() })
    }
  })

  socket.on('driver:online', (data: { vehicleNumber: number; driverName?: string }) => {
    if (!data || typeof data.vehicleNumber !== 'number') return
    ensureVehicle(data.vehicleNumber)
    setVehicleOnline(socket.id, data.vehicleNumber, data.driverName)
  })

  socket.on('driver:offline', (data: { vehicleNumber: number }) => {
    if (!data || typeof data.vehicleNumber !== 'number') return
    setVehicleOffline(data.vehicleNumber)
  })

  socket.on('gps:update', (data: { vehicleNumber: number; lat: number; lng: number; heading?: number }) => {
    if (!data || typeof data.vehicleNumber !== 'number') return
    const v = ensureVehicle(data.vehicleNumber)
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      v.realGps = true
      v.lat = data.lat
      v.lng = data.lng
      if (typeof data.heading === 'number') v.heading = data.heading
    }
  })

  // El chófer atendió el pedido: se avisa a la operadora
  socket.on('trip:ack', (data: { tripId: string; vehicleNumber: number }) => {
    if (!data) return
    io.emit('trip:ack', { tripId: data.tripId, vehicleNumber: data.vehicleNumber, ts: Date.now() })
    console.log(`Movil ${data.vehicleNumber} atendio el pedido ${data.tripId}`)
  })

  // Eventos emitidos por el backend Next.js: procesar y reenviar a todos
  socket.on('relay', (payload: { event: string; data: Record<string, unknown> }) => {
    if (!payload || typeof payload.event !== 'string') return
    const { event, data } = payload
    try {
      if (event === 'trip:assigned') {
        const vehicleNumber = Number(data.vehicleNumber)
        const address = String(data.address ?? 'pedido')
        const tripId = String(data.tripId ?? '')
        if (vehicleNumber) {
          const v = ensureVehicle(vehicleNumber)
          setPhase(v, 'to_pickup', pointFromSeed(address), tripId)
          if (!v.online) {
            // móvil ocupado pero sin enlace conectado: igualmente se lo ve ocupado en la grilla
            setPhase(v, 'to_pickup', pointFromSeed(address), tripId)
          }
        }
      } else if (event === 'trip:status') {
        const vehicleNumber = Number(data.vehicleNumber)
        const status = String(data.status ?? '')
        const tripId = String(data.tripId ?? '')
        if (vehicleNumber) {
          const v = ensureVehicle(vehicleNumber)
          if (status === 'IN_PROGRESS') {
            setPhase(v, 'to_dest', pointFromSeed(tripId + '-dest'), tripId)
          } else if (status === 'PENDING' || status === 'CANCELLED') {
            setPhase(v, 'idle', null, null)
          }
        }
      } else if (event === 'trip:completed') {
        const vehicleNumber = Number(data.vehicleNumber)
        if (vehicleNumber) {
          const v = ensureVehicle(vehicleNumber)
          setPhase(v, 'idle', null, null)
        }
      } else if (event === 'trip:cancelled') {
        const vehicleNumber = Number(data.vehicleNumber)
        if (vehicleNumber) {
          const v = ensureVehicle(vehicleNumber)
          setPhase(v, 'idle', null, null)
        }
      }
      io.emit(event, data)
      console.log(`Relay ${event}:`, JSON.stringify(data).slice(0, 200))
    } catch (err) {
      console.error('Error procesando relay', err)
    }
  })

  socket.on('disconnect', () => {
    for (const [number, set] of socketsByVehicle.entries()) {
      if (set.has(socket.id)) {
        set.delete(socket.id)
        if (set.size === 0) {
          setVehicleOffline(number)
        }
        break
      }
    }
    console.log(`Desconexion: ${socket.id}`)
  })

  socket.on('error', (error: unknown) => {
    console.error(`Error de socket (${socket.id}):`, error)
  })
})

httpServer.listen(PORT, () => {
  console.log(`RUSHTAXI fleet service en puerto ${PORT} - zona: Obelisco r=${ZONE_RADIUS}deg`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM, cerrando fleet service...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('SIGINT, cerrando fleet service...')
  httpServer.close(() => process.exit(0))
})
