import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { serializeTrip } from '@/lib/serialize'
import { relayToFleet } from '@/lib/emit'
import type { PaymentMethod } from '@/lib/types'

export const dynamic = 'force-dynamic'

type PatchBody = {
  action: 'assign' | 'ack' | 'start' | 'complete' | 'cancel'
  vehicleNumber?: number
  paymentMethod?: PaymentMethod
  amount?: number
}

// PATCH /api/trips/:id - acciones de despacho y ciclo de vida del viaje
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body: PatchBody = await req.json()
    const action = body.action

    const trip = await db.trip.findUnique({
      where: { id },
      include: { vehicle: true, driver: true, payment: true },
    })
    if (!trip) {
      return NextResponse.json({ error: 'El viaje no existe' }, { status: 404 })
    }

    if (action === 'assign') {
      const vehicleNumber = Number(body.vehicleNumber)
      if (!vehicleNumber) {
        return NextResponse.json({ error: 'Falta el número de móvil' }, { status: 400 })
      }
      if (trip.status !== 'PENDING') {
        return NextResponse.json({ error: 'El pedido ya no está pendiente' }, { status: 409 })
      }
      const vehicle = await db.vehicle.findUnique({
        where: { number: vehicleNumber },
        include: { driver: true },
      })
      if (!vehicle) {
        return NextResponse.json({ error: `El móvil ${vehicleNumber} no existe` }, { status: 404 })
      }
      // Verificar que el móvil no tenga otro viaje activo
      const activeTrip = await db.trip.findFirst({
        where: { vehicleId: vehicle.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, id: { not: trip.id } },
      })
      if (activeTrip) {
        return NextResponse.json({ error: `El móvil ${vehicleNumber} ya tiene un viaje en curso` }, { status: 409 })
      }

      const updated = await db.trip.update({
        where: { id: trip.id },
        data: {
          status: 'ASSIGNED',
          vehicleId: vehicle.id,
          driverId: vehicle.driverId,
        },
        include: { vehicle: true, driver: true, payment: true },
      })

      const dto = serializeTrip(updated)
      relayToFleet('trip:assigned', { trip: dto, vehicleNumber, address: trip.address })
      return NextResponse.json({ trip: dto })
    }

    if (action === 'ack') {
      if (trip.status !== 'ASSIGNED') {
        return NextResponse.json({ error: 'El viaje no está asignado' }, { status: 409 })
      }
      const updated = await db.trip.update({
        where: { id: trip.id },
        data: { acknowledgedAt: new Date() },
        include: { vehicle: true, driver: true, payment: true },
      })
      return NextResponse.json({ trip: serializeTrip(updated) })
    }

    if (action === 'start') {
      if (trip.status !== 'ASSIGNED') {
        return NextResponse.json({ error: 'El viaje no está asignado' }, { status: 409 })
      }
      const updated = await db.trip.update({
        where: { id: trip.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
        include: { vehicle: true, driver: true, payment: true },
      })
      relayToFleet('trip:status', {
        tripId: trip.id,
        status: 'IN_PROGRESS',
        vehicleNumber: trip.vehicle?.number ?? null,
      })
      return NextResponse.json({ trip: serializeTrip(updated) })
    }

    if (action === 'complete') {
      if (trip.status !== 'ASSIGNED' && trip.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'El viaje no está en curso' }, { status: 409 })
      }
      const method: PaymentMethod = body.paymentMethod === 'CARD' || body.paymentMethod === 'TRANSFER' ? body.paymentMethod : 'CASH'
      const amount = Number(body.amount ?? trip.fare) || trip.fare

      const updated = await db.$transaction(async (tx) => {
        const t = await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            paymentMethod: method,
            fare: amount,
          },
          include: { vehicle: true, driver: true, payment: true },
        })
        const payment = await tx.payment.upsert({
          where: { tripId: trip.id },
          create: { tripId: trip.id, amount, method, status: 'PAID' },
          update: { amount, method, status: 'PAID' },
        })
        return { t, payment }
      })

      const dto = serializeTrip(updated.t)
      relayToFleet('trip:completed', {
        trip: dto,
        payment: { id: updated.payment.id, amount: updated.payment.amount, method: updated.payment.method },
        vehicleNumber: trip.vehicle?.number ?? null,
      })
      return NextResponse.json({ trip: dto })
    }

    if (action === 'cancel') {
      if (trip.status === 'COMPLETED') {
        return NextResponse.json({ error: 'No se puede cancelar un viaje completado' }, { status: 409 })
      }
      const wasActive = trip.status === 'ASSIGNED' || trip.status === 'IN_PROGRESS'
      const updated = await db.trip.update({
        where: { id: trip.id },
        data: { status: 'CANCELLED' },
        include: { vehicle: true, driver: true, payment: true },
      })
      if (wasActive) {
        relayToFleet('trip:cancelled', { tripId: trip.id, vehicleNumber: trip.vehicle?.number ?? null })
      }
      return NextResponse.json({ trip: serializeTrip(updated) })
    }

    void Prisma
    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  } catch (err) {
    console.error('PATCH /api/trips/[id]', err)
    return NextResponse.json({ error: 'No se pudo actualizar el viaje' }, { status: 500 })
  }
}

// GET /api/trips/:id
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const trip = await db.trip.findUnique({
      where: { id },
      include: { vehicle: true, driver: true, payment: true },
    })
    if (!trip) return NextResponse.json({ error: 'El viaje no existe' }, { status: 404 })
    return NextResponse.json({ trip: serializeTrip(trip) })
  } catch (err) {
    console.error('GET /api/trips/[id]', err)
    return NextResponse.json({ error: 'No se pudo obtener el viaje' }, { status: 500 })
  }
}
