'use client'

// Vista "Viajes": historial completo de pedidos con filtros (estado, móvil, fechas),
// chips de resumen, tabla con scroll y cancelación con confirmación.

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Ban, Banknote, CreditCard, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { formatARSPlain, formatDateTime } from '@/lib/format'
import { PAYMENT_METHOD_LABEL, TRIP_STATUS_LABEL } from '@/lib/types'
import type { PaymentMethod, TripDTO, TripStatus } from '@/lib/types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type StatusFilter = TripStatus | 'ALL'
type PresetId = 'today' | '7d' | '30d' | 'all' | 'custom'

const STATUS_OPTIONS: StatusFilter[] = [
  'ALL',
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

const STATUS_BADGE_CLASS: Record<TripStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-400/15 text-amber-700',
  ASSIGNED: 'border-orange-300 bg-orange-500/15 text-orange-700',
  IN_PROGRESS: 'border-emerald-300 bg-emerald-500/15 text-emerald-700',
  COMPLETED: 'border-zinc-300 bg-zinc-500/15 text-zinc-700',
  CANCELLED: 'border-red-300 bg-red-500/15 text-red-700',
}

const PAYMENT_ICON: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
}

const CANCELLABLE_STATUSES: TripStatus[] = ['PENDING', 'ASSIGNED', 'IN_PROGRESS']

const VEHICLE_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1))

/** 'yyyy-mm-dd' de un <input type="date"> a ISO local. Con endOfDay suma 1 día para cubrir todo el día "hasta". */
function dateInputToISO(value: string, endOfDay: boolean): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = endOfDay ? new Date(year, month, day + 1) : new Date(year, month, day)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function inputDateOf(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function inputDateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return inputDateOf(d)
}

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'amber' | 'emerald'
}) {
  return (
    <div className="min-w-[130px] rounded-lg border bg-card px-4 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-bold tabular-nums text-zinc-900',
          accent === 'amber' && 'text-amber-700',
          accent === 'emerald' && 'text-emerald-700'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  const Icon = PAYMENT_ICON[method]
  return (
    <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
      <Icon className="h-3 w-3" aria-hidden />
      {PAYMENT_METHOD_LABEL[method]}
    </Badge>
  )
}

export function HistoryTab() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [preset, setPreset] = useState<PresetId>('all')

  const { fromISO, toISO } = useMemo(
    () => ({
      fromISO: fromDate ? dateInputToISO(fromDate, false) : null,
      toISO: toDate ? dateInputToISO(toDate, true) : null,
    }),
    [fromDate, toDate]
  )

  const query = useQuery<{ trips: TripDTO[] }>({
    queryKey: [
      'trips',
      'history',
      { status: statusFilter, vehicleNumber: vehicleFilter, from: fromISO, to: toISO },
    ],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (vehicleFilter !== 'ALL') params.set('vehicleNumber', vehicleFilter)
      if (fromISO) params.set('from', fromISO)
      if (toISO) params.set('to', toISO)
      params.set('limit', '300')
      const res = await fetch(`/api/trips?${params.toString()}`)
      if (!res.ok) throw new Error('No se pudo cargar el historial de viajes')
      return (await res.json()) as { trips: TripDTO[] }
    },
    refetchInterval: 30_000,
  })

  const cancelMutation = useMutation<{ trip: TripDTO }, Error, { id: string; code: number }>({
    mutationFn: async ({ id }) => {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' as const }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'No se pudo cancelar el viaje')
      }
      return (await res.json()) as { trip: TripDTO }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success(`Pedido #${variables.code} cancelado`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const stats = useMemo(() => {
    const trips = query.data?.trips ?? []
    const completed = trips.filter((t) => t.status === 'COMPLETED')
    const billed = completed.reduce((acc, t) => acc + t.fare, 0)
    return {
      total: trips.length,
      completed: completed.length,
      billed,
      average: completed.length > 0 ? billed / completed.length : null,
    }
  }, [query.data])

  const trips = query.data?.trips ?? []
  const todayInput = inputDateOf(new Date())

  const presets: { id: PresetId; label: string; apply: () => void }[] = [
    {
      id: 'today',
      label: 'Hoy',
      apply: () => {
        setFromDate(todayInput)
        setToDate(todayInput)
        setPreset('today')
      },
    },
    {
      id: '7d',
      label: '7 días',
      apply: () => {
        setFromDate(inputDateDaysAgo(6))
        setToDate(todayInput)
        setPreset('7d')
      },
    },
    {
      id: '30d',
      label: '30 días',
      apply: () => {
        setFromDate(inputDateDaysAgo(29))
        setToDate(todayInput)
        setPreset('30d')
      },
    },
    {
      id: 'all',
      label: 'Todo',
      apply: () => {
        setFromDate('')
        setToDate('')
        setPreset('all')
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">Viajes</h2>
        <p className="text-sm text-zinc-500">
          Historial completo de pedidos con filtros, resumen y cancelación.
        </p>
      </div>

      {/* Filtros */}
      <Card className="gap-4 py-4 md:py-6">
        <CardContent className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 md:px-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estado</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[150px]" aria-label="Filtrar por estado del viaje">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'ALL' ? 'Todos' : TRIP_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Móvil</span>
            <Select value={vehicleFilter} onValueChange={(v) => setVehicleFilter(v)}>
              <SelectTrigger className="w-[110px]" aria-label="Filtrar por número de móvil">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {VEHICLE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Desde</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setPreset('custom')
              }}
              className="w-[150px]"
              aria-label="Fecha desde"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hasta</span>
            <Input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value)
                setPreset('custom')
              }}
              className="w-[150px]"
              aria-label="Fecha hasta"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Período rápido
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={p.apply}
                  aria-pressed={preset === p.id}
                  className={cn(
                    'h-9 px-3 text-xs font-semibold',
                    preset === p.id
                      ? 'border-amber-400 bg-amber-400 text-zinc-950 hover:bg-amber-500 hover:text-zinc-950'
                      : 'border-zinc-300 bg-card text-zinc-600 hover:bg-zinc-100'
                  )}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chips resumen del listado */}
      <div className="flex flex-wrap gap-3" aria-label="Resumen del listado de viajes">
        <SummaryChip label="Total viajes" value={String(stats.total)} />
        <SummaryChip label="Completados" value={String(stats.completed)} accent="emerald" />
        <SummaryChip label="Facturado" value={formatARSPlain(stats.billed)} accent="amber" />
        <SummaryChip
          label="Promedio por viaje completado"
          value={stats.average !== null ? formatARSPlain(stats.average) : '--'}
        />
      </div>

      {/* Tabla de viajes */}
      {query.isPending ? (
        <div className="space-y-2 rounded-lg border bg-card p-4" aria-label="Cargando viajes">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-700">
            No se pudo cargar el historial de viajes. Reintentá en unos segundos.
          </p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : trips.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-card p-10 text-center">
          <p className="text-sm font-medium text-zinc-500">No hay viajes con esos filtros</p>
          <p className="mt-1 text-xs text-zinc-400">
            Probá ampliar el rango de fechas o cambiar el estado.
          </p>
        </div>
      ) : (
        <div className="max-h-[560px] overflow-auto rounded-lg border bg-card">
          <Table className="min-w-[960px]">
            <TableCaption className="sr-only">
              Listado de viajes con pedido, fecha, móvil, chofer, dirección, pasajero, estado, tarifa, pago y acciones
            </TableCaption>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Móvil</TableHead>
                <TableHead>Chofer</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Pasajero</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Tarifa</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell>
                    <span className="font-mono font-semibold text-zinc-900">#{trip.code}</span>
                  </TableCell>
                  <TableCell className="tabular-nums text-zinc-600">
                    {formatDateTime(trip.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-zinc-700">
                    {trip.vehicleNumber ?? '-'}
                  </TableCell>
                  <TableCell className="text-zinc-700">{trip.driverName ?? '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="max-w-[240px] truncate text-zinc-700">{trip.address}</span>
                      {trip.zone && (
                        <Badge
                          variant="outline"
                          className="border-zinc-300 bg-zinc-100 text-[10px] text-zinc-600"
                        >
                          {trip.zone}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-700">{trip.passengerName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[trip.status]}>
                      {TRIP_STATUS_LABEL[trip.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-zinc-900">
                    {formatARSPlain(trip.fare)}
                  </TableCell>
                  <TableCell>
                    {trip.status === 'COMPLETED' && trip.paymentMethod ? (
                      <PaymentBadge method={trip.paymentMethod} />
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {CANCELLABLE_STATUSES.includes(trip.status) ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            disabled={cancelMutation.isPending}
                            aria-label={`Cancelar pedido #${trip.code}`}
                          >
                            {cancelMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Ban className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Cancelar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar pedido #{trip.code}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se va a cancelar el viaje a &quot;{trip.address}&quot;
                              {trip.vehicleNumber ? ` asignado al móvil ${trip.vehicleNumber}` : ''}. El
                              móvil quedará libre y esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No, volver</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40"
                              onClick={() =>
                                cancelMutation.mutate({ id: trip.id, code: trip.code })
                              }
                            >
                              Sí, cancelar pedido
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
