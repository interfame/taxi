import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PATCH /api/drivers/:id - editar datos, activar/desactivar o cambiar móvil
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()

    const driver = await db.driver.findUnique({ where: { id }, include: { vehicle: true } })
    if (!driver) {
      return NextResponse.json({ error: 'El chofer no existe' }, { status: 404 })
    }

    const data: { name?: string; phone?: string; license?: string; active?: boolean; online?: boolean } = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.phone !== undefined) data.phone = String(body.phone).trim()
    if (body.license !== undefined) data.license = String(body.license).trim()
    if (body.active !== undefined) data.active = Boolean(body.active)
    if (body.online !== undefined) data.online = Boolean(body.online)

    let vehicleNumber: number | null | undefined = undefined
    if (body.vehicleNumber !== undefined) {
      if (body.vehicleNumber === null || body.vehicleNumber === '') {
        vehicleNumber = null
      } else {
        const n = Number(body.vehicleNumber)
        if (!Number.isNaN(n)) vehicleNumber = n
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // Cambio de móvil
      if (vehicleNumber !== undefined) {
        // liberar el móvil actual si lo tiene
        if (driver.vehicle?.id) {
          await tx.vehicle.update({ where: { id: driver.vehicle.id }, data: { driverId: null } })
        }
        if (vehicleNumber !== null) {
          const target = await tx.vehicle.findUnique({ where: { number: vehicleNumber }, include: { driver: true } })
          if (!target) throw new Error(`El móvil ${vehicleNumber} no existe`)
          if (target.driverId && target.driverId !== driver.id) {
            throw new Error(`El móvil ${vehicleNumber} ya tiene chofer asignado`)
          }
          await tx.vehicle.update({ where: { id: target.id }, data: { driverId: driver.id } })
        }
      }
      return tx.driver.update({ where: { id }, data, include: { vehicle: true } })
    })

    return NextResponse.json({
      driver: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo actualizar el chofer'
    console.error('PATCH /api/drivers/[id]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
