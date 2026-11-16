import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeVehicle } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/vehicles - grilla de móviles con chofer y viaje en curso
export async function GET() {
  try {
    const vehicles = await db.vehicle.findMany({
      include: { driver: true },
      orderBy: { number: 'asc' },
    })

    const currentTrips = await db.trip.findMany({
      where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: { vehicle: true, driver: true, payment: true },
    })
    const byVehicleId = new Map<string, (typeof currentTrips)[number]>()
    for (const t of currentTrips) {
      if (t.vehicleId) byVehicleId.set(t.vehicleId, t)
    }

    return NextResponse.json({
      vehicles: vehicles.map((v) => serializeVehicle(v, byVehicleId.get(v.id) ?? null)),
    })
  } catch (err) {
    console.error('GET /api/vehicles', err)
    return NextResponse.json({ error: 'No se pudo listar la flota' }, { status: 500 })
  }
}
