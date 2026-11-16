import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeTrip } from '@/lib/serialize'
import type { TripDTO, VehiclePhase, VehiclePos } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/fleet/sync
//
// Fallback HTTP del canal en tiempo real para entornos serverless (Vercel),
// donde no se puede mantener un servicio WebSocket persistente.
// Devuelve en una sola respuesta:
//  - positions: posiciones de los móviles (simulación determinista en función del tiempo)
//  - trips:     los viajes "vivos" + últimos finalizados, para que cada cliente
//               detecte novedades comparando con su estado anterior.
//
// El cliente (fleet-provider) sondea cada ~2.5s mientras el socket no esté disponible.
const CENTER = { lat: -34.6037, lng: -58.3816 } // Obelisco (CABA), igual que fleet-service

export async function GET() {
  try {
    const [vehicles, liveTrips, recentDone] = await Promise.all([
      db.vehicle.findMany({ include: { driver: true } }),
      db.trip.findMany({
        where: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
        include: { vehicle: true, driver: true, payment: true },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      db.trip.findMany({
        where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
        include: { vehicle: true, driver: true, payment: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

    // móviles ocupados: con viaje asignado o en curso
    const busyNumbers = new Set<number>()
    for (const t of liveTrips) {
      if (t.vehicle && (t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS')) {
        busyNumbers.add(t.vehicle.number)
      }
    }

    // Simulación determinista (sin estado en memoria): cada móvil recorre una
    // órbita propia dentro de la zona; los ocupados quedan quietos.
    const nowSec = Date.now() / 1000
    const total = Math.max(vehicles.length, 20)
    const positions: VehiclePos[] = vehicles.map((v) => {
      const n = v.number
      const online = Boolean(v.driver?.online)
      const busy = busyNumbers.has(n)
      const base = (n / total) * Math.PI * 2
      const radius = 0.006 + ((n * 7) % 5) * 0.0022
      const speed = 0.02 + (n % 5) * 0.008
      const angle = busy ? base : base + nowSec * speed
      const phase: VehiclePhase = busy ? 'to_pickup' : 'idle'
      return {
        number: n,
        lat: CENTER.lat + Math.sin(angle) * radius,
        lng: CENTER.lng + Math.cos(angle) * radius * 0.85,
        heading: Math.round((((angle * 180) / Math.PI) + 90) % 360),
        online,
        phase,
        busy,
      }
    })

    const trips: TripDTO[] = [...liveTrips, ...recentDone].map(serializeTrip)

    return NextResponse.json({ ts: Date.now(), positions, trips })
  } catch (err) {
    console.error('GET /api/fleet/sync', err)
    return NextResponse.json({ error: 'No se pudo sincronizar la flota' }, { status: 500 })
  }
}
