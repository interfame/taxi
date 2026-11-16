import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { DriverWithStatsDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/drivers - choferes con móvil asignado y estadísticas
export async function GET() {
  try {
    const drivers = await db.driver.findMany({
      include: { vehicle: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    })

    const completed = await db.trip.findMany({
      where: { status: 'COMPLETED', driverId: { not: null }, payment: { isNot: null } },
      select: { driverId: true, payment: { select: { amount: true } } },
    })

    const stats = new Map<string, { completedTrips: number; earned: number }>()
    for (const t of completed) {
      if (!t.driverId) continue
      const cur = stats.get(t.driverId) ?? { completedTrips: 0, earned: 0 }
      cur.completedTrips += 1
      cur.earned += t.payment?.amount ?? 0
      stats.set(t.driverId, cur)
    }

    const list: DriverWithStatsDTO[] = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      license: d.license,
      active: d.active,
      createdAt: d.createdAt.toISOString(),
      vehicleNumber: d.vehicle?.number ?? null,
      vehiclePlate: d.vehicle?.plate ?? null,
      vehicleModel: d.vehicle?.model ?? null,
      completedTrips: stats.get(d.id)?.completedTrips ?? 0,
      earned: stats.get(d.id)?.earned ?? 0,
    }))

    return NextResponse.json({ drivers: list })
  } catch (err) {
    console.error('GET /api/drivers', err)
    return NextResponse.json({ error: 'No se pudo listar los choferes' }, { status: 500 })
  }
}

// POST /api/drivers - alta de chofer (opcionalmente con móvil asignado)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = String(body.name ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const license = String(body.license ?? '').trim()

    if (!name || !phone || !license) {
      return NextResponse.json({ error: 'Nombre, teléfono y licencia son obligatorios' }, { status: 400 })
    }

    let vehicleNumber: number | null = null
    if (body.vehicleNumber !== undefined && body.vehicleNumber !== null && body.vehicleNumber !== '') {
      vehicleNumber = Number(body.vehicleNumber)
      if (Number.isNaN(vehicleNumber)) vehicleNumber = null
    }

    const driver = await db.$transaction(async (tx) => {
      let vehicleId: string | undefined
      if (vehicleNumber) {
        const vehicle = await tx.vehicle.findUnique({ where: { number: vehicleNumber }, include: { driver: true } })
        if (!vehicle) throw new Error(`El móvil ${vehicleNumber} no existe`)
        if (vehicle.driverId) throw new Error(`El móvil ${vehicleNumber} ya tiene chofer asignado`)
        vehicleId = vehicle.id
      }
      const created = await tx.driver.create({
        data: { name, phone, license, active: true, ...(vehicleId ? { vehicle: { connect: { id: vehicleId } } } : {}) },
        include: { vehicle: true },
      })
      return created
    })

    return NextResponse.json({ driver: { ...driver, createdAt: driver.createdAt.toISOString() } }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error && !err.message.includes('Invalid') ? err.message : 'No se pudo crear el chofer'
    console.error('POST /api/drivers', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
