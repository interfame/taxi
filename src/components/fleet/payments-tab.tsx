'use client'

// Vista "Pagos": recaudación con resumen (hoy + por método), gráfico de barras
// de los últimos 7 días (Tailwind puro) y tabla de detalle de pagos.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Banknote, CreditCard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatARS, formatARSPlain, formatDateTime } from '@/lib/format'
import { PAYMENT_METHOD_LABEL } from '@/lib/types'
import type { PaymentMethod, PaymentsResponse } from '@/lib/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PaymentsRange = 'today' | '7d' | '30d' | 'all'

const RANGE_OPTIONS: { id: PaymentsRange; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'all', label: 'Todo' },
]

const METHOD_META: Record<PaymentMethod, { icon: LucideIcon; chip: string; badge: string }> = {
  CASH: {
    icon: Banknote,
    chip: 'bg-amber-400/15 text-amber-700',
    badge: 'border-amber-300 bg-amber-400/15 text-amber-700',
  },
  CARD: {
    icon: CreditCard,
    chip: 'bg-emerald-500/15 text-emerald-700',
    badge: 'border-emerald-300 bg-emerald-500/15 text-emerald-700',
  },
  TRANSFER: {
    icon: ArrowLeftRight,
    chip: 'bg-zinc-500/15 text-zinc-700',
    badge: 'border-zinc-300 bg-zinc-500/15 text-zinc-700',
  },
}

/** from/to ISO del rango elegido, en hora local. "to" = inicio del día siguiente para cubrir el día completo. */
function rangeToISO(range: PaymentsRange): { from: string | null; to: string | null } {
  if (range === 'all') return { from: null, to: null }
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const daysBack = range === 'today' ? 0 : range === '7d' ? 6 : 29
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack))
  const to = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  return { from: from.toISOString(), to: to.toISOString() }
}

function MethodBadge({ method }: { method: PaymentMethod }) {
  const meta = METHOD_META[method]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={meta.badge}>
      <Icon className="h-3 w-3" aria-hidden />
      {PAYMENT_METHOD_LABEL[method]}
    </Badge>
  )
}

function MethodCard({
  method,
  total,
  count,
}: {
  method: PaymentMethod
  total: number
  count: number
}) {
  const meta = METHOD_META[method]
  const Icon = meta.icon
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.chip)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {PAYMENT_METHOD_LABEL[method]}
          </p>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{formatARS(total)}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {count} {count === 1 ? 'pago' : 'pagos'}
        </p>
      </CardContent>
    </Card>
  )
}

export function PaymentsTab() {
  const [range, setRange] = useState<PaymentsRange>('7d')

  const query = useQuery<PaymentsResponse>({
    queryKey: ['payments', { range }],
    queryFn: async () => {
      const params = new URLSearchParams()
      const { from, to } = rangeToISO(range)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('limit', '200')
      const res = await fetch(`/api/payments?${params.toString()}`)
      if (!res.ok) throw new Error('No se pudo cargar los pagos')
      return (await res.json()) as PaymentsResponse
    },
    refetchInterval: 30_000,
  })

  const summary = query.data?.summary
  const payments = query.data?.payments ?? []
  const days = summary?.last7Days ?? []
  const weekTotal = days.reduce((acc, d) => acc + d.total, 0)
  const maxDayTotal = Math.max(...days.map((d) => d.total), 0)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">Pagos</h2>
        <p className="text-sm text-zinc-500">Recaudación por método y detalle de cobros.</p>
      </div>

      {/* Filtro de período */}
      <Card className="gap-4 py-4 md:py-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6">
          <p className="text-sm font-semibold text-zinc-700">Período</p>
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRange(option.id)}
                aria-pressed={range === option.id}
                className={cn(
                  'h-9 px-3 text-xs font-semibold',
                  range === option.id
                    ? 'border-amber-400 bg-amber-400 text-zinc-950 hover:bg-amber-500 hover:text-zinc-950'
                    : 'border-zinc-300 bg-card text-zinc-600 hover:bg-zinc-100'
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {query.isPending ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Cargando resumen">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-52 rounded-xl" />
          <div className="space-y-2 rounded-lg border p-4" aria-label="Cargando pagos">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </>
      ) : query.isError || !summary ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-700">
            No se pudo cargar los pagos. Reintentá en unos segundos.
          </p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {/* Resumen: hoy + métodos presentes */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Recaudado hoy
                </p>
                <p className="mt-1.5 text-3xl font-black tabular-nums tracking-tight text-zinc-900">
                  {formatARS(summary.todayTotal)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {summary.todayCount} {summary.todayCount === 1 ? 'viaje' : 'viajes'}
                </p>
              </CardContent>
            </Card>
            {summary.byMethod.map((m) => (
              <MethodCard key={m.method} method={m.method} total={m.total} count={m.count} />
            ))}
          </div>

          {/* Mini gráfico de barras: últimos 7 días */}
          <Card className="gap-4 py-4 md:py-6">
            <CardContent className="px-4 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">Recaudación - últimos 7 días</h3>
                <span className="text-xs font-medium tabular-nums text-zinc-500">
                  Total: {formatARSPlain(weekTotal)}
                </span>
              </div>
              <div
                className="mt-4 flex h-28 items-end gap-2"
                role="img"
                aria-label="Gráfico de barras: recaudación de los últimos 7 días"
              >
                {days.map((day) => {
                  const pct =
                    maxDayTotal > 0 && day.total > 0
                      ? Math.max(2, Math.round((day.total / maxDayTotal) * 100))
                      : 0
                  return (
                    <div
                      key={day.date}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                      title={`${day.label}: ${formatARS(day.total)} - ${day.count} ${day.count === 1 ? 'viaje' : 'viajes'}`}
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-zinc-600">
                        {formatARSPlain(day.total)}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            'w-full rounded-t',
                            day.total > 0 ? 'bg-amber-400' : 'bg-amber-400/40'
                          )}
                          style={{ height: `${pct}%`, minHeight: 4 }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{day.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detalle de pagos */}
          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-card p-10 text-center">
              <p className="text-sm font-medium text-zinc-500">
                Todavía no hay pagos en este período
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Los pagos aparecen cuando los chóferes completan viajes.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm font-semibold text-zinc-700">
                Detalle de pagos <span className="font-normal text-zinc-400">({payments.length})</span>
              </p>
              <div className="max-h-[480px] overflow-auto rounded-lg border bg-card">
                <Table className="min-w-[780px]">
                  <TableCaption className="sr-only">
                    Listado de pagos con pedido, fecha, móvil, chofer, dirección, método, estado y monto
                  </TableCaption>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Móvil</TableHead>
                      <TableHead>Chofer</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <span className="font-mono font-semibold text-zinc-900">
                            {payment.tripCode !== null ? `#${payment.tripCode}` : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums text-zinc-600">
                          {formatDateTime(payment.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-zinc-700">
                          {payment.vehicleNumber ?? '-'}
                        </TableCell>
                        <TableCell className="text-zinc-700">{payment.driverName ?? '-'}</TableCell>
                        <TableCell>
                          <span className="block max-w-[260px] truncate text-zinc-700">
                            {payment.tripAddress ?? '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <MethodBadge method={payment.method} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-500/15 text-emerald-700"
                          >
                            Pagado
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-zinc-900">
                          {formatARSPlain(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
