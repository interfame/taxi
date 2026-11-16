import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { serializeTrip } from '@/lib/serialize'
import { relayToFleet } from '@/lib/emit'

export const dynamic = 'force-dynamic'

// GET /api/trips?status=PENDING,ASSIGNED&vehicleNumber=5&from=&to=&q=&limit=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const where: Prisma.TripWhereInput = {}

    const status = sp.get('status')
    if (status) {
      const list = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (list.length) where.status = { in: list }
    }

    const vehicleNumber = sp.get('vehicleNumber')
    if (vehicleNumber && !Number.isNaN(Number(vehicleNumber))) {
      where.vehicle = { number: Number(vehicleNumber) }
    }

    const from = sp.get('from')
    const to = sp.get('to')
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const q = sp.get('q')
    if (q) {
      where.OR = [
        { address: { contains: q } },
        { passengerName: { contains: q } },
      ]
    }

    const limit = Math.min(Number(sp.get('limit') ?? 200) || 200, 500)

    const trips = await db.trip.findMany({
      where,
      include: { vehicle: true, driver: true, payment: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ trips: trips.map(serializeTrip) })
  } catch (err) {
    console.error('GET /api/trips', err)
    return NextResponse.json({ error: 'No se pudo listar los viajes' }, { status: 500 })
  }
}

// POST /api/trips - operador carga un pedido
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const address = String(body.address ?? '').trim()
    const passengerName = String(body.passengerName ?? '').trim()

    if (!address) {
      return NextResponse.json({ error: 'La dirección del pedido es obligatoria' }, { status: 400 })
    }
    if (!passengerName) {
      return NextResponse.json({ error: 'El nombre del pasajero es obligatorio' }, { status: 400 })
    }

    let scheduledAt: Date | null = null
    if (body.scheduledAt) {
      const d = new Date(body.scheduledAt)
      if (!Number.isNaN(d.getTime())) scheduledAt = d
    }

    const fare = Number(body.fare ?? 0) || 0

    const created = await db.$transaction(async (tx) => {
      const last = await tx.trip.findFirst({ orderBy: { code: 'desc' }, select: { code: true } })
      const code = (last?.code ?? 0) + 1
      return tx.trip.create({
        data: {
          code,
          address,
          zone: body.zone ? String(body.zone).trim() : null,
          passengerName,
          passengerPhone: body.passengerPhone ? String(body.passengerPhone).trim() : null,
          fare,
          notes: body.notes ? String(body.notes).trim() : null,
          scheduledAt,
          status: 'PENDING',
        },
      })
    })

    const trip = serializeTrip(created)
    relayToFleet('trip:new', { trip })

    return NextResponse.json({ trip }, { status: 201 })
  } catch (err) {
    console.error('POST /api/trips', err)
    return NextResponse.json({ error: 'No se pudo cargar el pedido' }, { status: 500 })
  }
}
