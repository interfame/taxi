import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { startOfTodayART, startOfDayDaysAgoART, shortDayLabel } from '@/lib/dates'
import type { PaymentDTO, PaymentMethod, PaymentsResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/payments?from=&to=&method=&limit=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const where: Prisma.PaymentWhereInput = {}

    const from = sp.get('from')
    const to = sp.get('to')
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const method = sp.get('method')
    if (method) where.method = method

    const limit = Math.min(Number(sp.get('limit') ?? 150) || 150, 400)

    const [paymentsRaw, allPayments] = await Promise.all([
      db.payment.findMany({
        where,
        include: { trip: { include: { vehicle: true, driver: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.payment.findMany({ select: { amount: true, method: true, createdAt: true } }),
    ])

    const payments: PaymentDTO[] = paymentsRaw.map((p) => ({
      id: p.id,
      tripId: p.tripId,
      amount: p.amount,
      method: p.method as PaymentMethod,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      tripCode: p.trip?.code ?? null,
      tripAddress: p.trip?.address ?? null,
      vehicleNumber: p.trip?.vehicle?.number ?? null,
      driverName: p.trip?.driver?.name ?? null,
    }))

    // Resumen en hora local de Buenos Aires
    const todayStart = startOfTodayART()
    const weekAgo = startOfDayDaysAgoART(6)

    let todayTotal = 0
    let todayCount = 0
    const byMethodMap = new Map<PaymentMethod, { total: number; count: number }>()
    const dayMap = new Map<string, { total: number; count: number; label: string }>()

    for (let i = 6; i >= 0; i--) {
      const d = startOfDayDaysAgoART(i)
      dayMap.set(d.toISOString(), { total: 0, count: 0, label: shortDayLabel(d) })
    }

    for (const p of allPayments) {
      const m = (p.method as PaymentMethod) ?? 'CASH'
      if (p.createdAt >= todayStart) {
        todayTotal += p.amount
        todayCount += 1
      }
      if (p.createdAt >= weekAgo) {
        const cur = byMethodMap.get(m) ?? { total: 0, count: 0 }
        cur.total += p.amount
        cur.count += 1
        byMethodMap.set(m, cur)

        // inicio del día (ART) al que pertenece el pago
        const key = startOfDayDaysAgoART(0, p.createdAt).toISOString()
        const day = dayMap.get(key)
        if (day) {
          day.total += p.amount
          day.count += 1
        }
      }
    }

    const last7Days = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, label: v.label, total: v.total, count: v.count }))

    const byMethod = Array.from(byMethodMap.entries())
      .map(([methodKey, v]) => ({ method: methodKey, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)

    const summary = { todayTotal, todayCount, byMethod, last7Days }
    const response: PaymentsResponse = { summary, payments }
    return NextResponse.json(response)
  } catch (err) {
    console.error('GET /api/payments', err)
    return NextResponse.json({ error: 'No se pudo listar los pagos' }, { status: 500 })
  }
}
