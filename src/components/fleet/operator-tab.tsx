// Consola del operador: cargar pedidos, grilla de móviles y asignación con F8
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BellRing,
  CalendarClock,
  CarTaxiFront,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatARSPlain, formatTime } from '@/lib/format'
import { useFleetStore } from '@/lib/store'
import { fleetAlarm } from '@/lib/alarm'
import type { TripDTO, VehicleDTO } from '@/lib/types'

const ZONES = [
  'Centro', 'Once', 'Constitución', 'Retiro', 'San Telmo', 'Monserrat', 'Recoleta',
  'Palermo', 'Almagro', 'Balvanera', 'Villa Crespo', 'Caballito', 'Boedo',
  'San Cristóbal', 'Flores', 'Belgrano', 'Barracas', 'Puerto Madero',
]

type VehiclesResponse = { vehicles: VehicleDTO[] }
type TripsResponse = { trips: TripDTO[] }
type TripResponse = { trip: TripDTO }

// ---------- Formulario de carga de pedido ----------

function TripForm() {
  const queryClient = useQueryClient()
  const [address, setAddress] = useState('')
  const [passengerName, setPassengerName] = useState('')
  const [passengerPhone, setPassengerPhone] = useState('')
  const [zone, setZone] = useState<string>('none')
  const [fare, setFare] = useState('')
  const [schedule, setSchedule] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          passengerName,
          passengerPhone: passengerPhone || null,
          zone: zone !== 'none' ? zone : null,
          fare: fare ? Number(fare) : 0,
          scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar el pedido')
      return data as TripResponse
    },
    onSuccess: (data) => {
      toast.success(`Pedido #${data.trip.code} cargado`, { description: data.trip.address })
      setAddress('')
      setPassengerName('')
      setPassengerPhone('')
      setFare('')
      setNotes('')
      setSchedule(false)
      setScheduledAt('')
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-amber-500" aria-hidden />
          Nuevo pedido
        </CardTitle>
        <CardDescription>Cargá la dirección y asigná el móvil</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="trip-address">Dirección *</Label>
          <Input
            id="trip-address"
            placeholder="Calle, altura, localidad"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="trip-passenger">Pasajero *</Label>
            <Input
              id="trip-passenger"
              placeholder="Nombre y apellido"
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-phone">Teléfono</Label>
            <Input
              id="trip-phone"
              placeholder="11..."
              value={passengerPhone}
              onChange={(e) => setPassengerPhone(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Zona</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger aria-label="Zona del pedido">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="none">Sin zona</SelectItem>
                {ZONES.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-fare">Tarifa estimada ($)</Label>
            <Input
              id="trip-fare"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={fare}
              onChange={(e) => setFare(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-notes">Notas para el chófer</Label>
          <Textarea
            id="trip-notes"
            rows={2}
            placeholder="Ej: pasajero con valija, puerta marrón..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="rounded-lg border border-dashed border-zinc-300 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium" htmlFor="trip-schedule">
            <Checkbox
              id="trip-schedule"
              checked={schedule}
              onCheckedChange={(v) => setSchedule(v === true)}
            />
            <CalendarClock className="h-4 w-4 text-amber-500" aria-hidden />
            Programar para más tarde
          </label>
          {schedule && (
            <Input
              aria-label="Fecha y hora programada"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          )}
        </div>
        <Button
          className="w-full bg-amber-400 font-bold text-zinc-950 hover:bg-amber-300"
          disabled={createMut.isPending || !address.trim() || !passengerName.trim() || (schedule && !scheduledAt)}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            'CARGAR PEDIDO'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- Lista de pedidos pendientes ----------

function isDue(t: TripDTO, now: number): boolean {
  return !!t.scheduledAt && new Date(t.scheduledAt).getTime() <= now
}

function PendingTrips({
  trips,
  selectedTripId,
  onSelect,
  onAssign,
  onCancel,
  cancelingId,
}: {
  trips: TripDTO[]
  selectedTripId: string | null
  onSelect: (id: string) => void
  onAssign: (tripId: string) => void
  onCancel: (trip: TripDTO) => void
  cancelingId: string | null
}) {
  const now = Date.now()
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" aria-hidden />
            Pedidos pendientes
          </span>
          <Badge variant={trips.length > 0 ? 'default' : 'outline'} className={trips.length > 0 ? 'bg-amber-400 text-zinc-950' : ''}>
            {trips.length}
          </Badge>
        </CardTitle>
        <CardDescription>Seleccioná un pedido y asignalo con F8 o tocando un móvil</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[420px] space-y-2 overflow-y-auto pr-2">
        {trips.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">No hay pedidos pendientes</p>
        )}
        {trips.map((t) => {
          const due = isDue(t, now)
          const selected = selectedTripId === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={selected}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-colors',
                due && 'border-red-400 bg-red-50',
                selected && !due && 'border-amber-400 bg-amber-50',
                !selected && !due && 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                  #{t.code}
                  {t.scheduledAt && (
                    <Badge variant="outline" className={cn('gap-1 text-[10px]', due ? 'animate-pulse border-red-400 text-red-700' : 'border-amber-400 text-amber-700')}>
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {due ? '¡LLEGÓ LA HORA!' : `Programado ${formatTime(t.scheduledAt)}`}
                    </Badge>
                  )}
                </span>
                {t.fare > 0 && <span className="text-sm font-semibold text-amber-600">{formatARSPlain(t.fare)}</span>}
              </div>
              <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-zinc-800">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                {t.address}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden />
                  {t.passengerName}
                  {t.zone && <Badge variant="outline" className="ml-1 border-zinc-300 text-[10px] text-zinc-600">{t.zone}</Badge>}
                </span>
                <span className="flex gap-1.5">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAssign(t.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        onAssign(t.id)
                      }
                    }}
                    className="rounded bg-zinc-900 px-2 py-1 text-[11px] font-bold text-amber-400 hover:bg-zinc-800"
                  >
                    ASIGNAR (F8)
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancel(t)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        onCancel(t)
                      }
                    }}
                    aria-disabled={cancelingId === t.id}
                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    {cancelingId === t.id ? 'Cancelando...' : 'Cancelar'}
                  </span>
                </span>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ---------- Grilla de móviles ----------

type VehicleState = 'busy' | 'free' | 'offline' | 'no-driver'

function vehicleState(v: VehicleDTO, positions: Record<number, { online: boolean; busy: boolean }>): VehicleState {
  if (!v.driver || !v.driver.active) return 'no-driver'
  const pos = positions[v.number]
  if (!pos || !pos.online) return 'offline'
  if (v.currentTrip || pos.busy) return 'busy'
  return 'free'
}

const STATE_STYLES: Record<VehicleState, { tile: string; badge: string; label: string }> = {
  busy: {
    tile: 'border-amber-400 bg-amber-50 hover:bg-amber-100',
    badge: 'bg-amber-400 text-zinc-950',
    label: 'OCUPADO',
  },
  free: {
    tile: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
    badge: 'bg-emerald-500 text-white',
    label: 'LIBRE',
  },
  offline: {
    tile: 'border-zinc-200 bg-zinc-100 hover:bg-zinc-200/70',
    badge: 'bg-zinc-400 text-white',
    label: 'DESCONECTADO',
  },
  'no-driver': {
    tile: 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 opacity-70',
    badge: 'bg-zinc-300 text-zinc-600',
    label: 'SIN CHOFER',
  },
}

function VehicleGrid({
  vehicles,
  selectedTripId,
  onTileClick,
}: {
  vehicles: VehicleDTO[]
  selectedTripId: string | null
  onTileClick: (vehicleNumber: number, state: VehicleState) => void
}) {
  const positions = useFleetStore((s) => s.positions)
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {vehicles.map((v) => {
        const state = vehicleState(v, positions)
        const style = STATE_STYLES[state]
        const pos = positions[v.number]
        return (
          <button
            key={v.id}
            onClick={() => onTileClick(v.number, state)}
            aria-label={`Móvil ${v.number}, ${style.label.toLowerCase()}${v.driver ? `, chofer ${v.driver.name}` : ', sin chofer'}`}
            className={cn(
              'relative flex flex-col items-start rounded-lg border p-2.5 text-left transition-all active:scale-[0.98]',
              style.tile,
              selectedTripId && (state === 'free' || state === 'busy') && 'cursor-pointer ring-2 ring-amber-400/60'
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-black leading-none text-zinc-900">{v.number}</span>
              <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide', style.badge)}>
                {style.label}
              </span>
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold text-zinc-700">
              {v.driver ? v.driver.name : 'Sin chofer'}
            </p>
            <p className="truncate text-[10px] text-zinc-500">
              {v.model} · {v.plate}
            </p>
            {v.currentTrip && (
              <p className="mt-1 line-clamp-2 w-full rounded bg-amber-400/20 px-1.5 py-1 text-[10px] font-medium text-amber-900">
                #{v.currentTrip.code}: {v.currentTrip.address}
              </p>
            )}
            {state !== 'offline' && state !== 'no-driver' && pos && (
              <span className="absolute right-2 bottom-2 flex h-2 w-2">
                <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', state === 'busy' ? 'bg-amber-500' : 'bg-emerald-500')} />
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', state === 'busy' ? 'bg-amber-500' : 'bg-emerald-500')} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Diálogo de asignación ----------

function AssignDialog({
  open,
  onOpenChange,
  pendingTrips,
  vehicles,
  initialTripId,
  onAssign,
  assigning,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pendingTrips: TripDTO[]
  vehicles: VehicleDTO[]
  initialTripId: string | null
  onAssign: (tripId: string, vehicleNumber: number) => void
  assigning: boolean
}) {
  const positions = useFleetStore((s) => s.positions)
  const [tripId, setTripId] = useState<string | null>(initialTripId)
  const [vehicleNumber, setVehicleNumber] = useState<number | null>(null)
  const [prevOpen, setPrevOpen] = useState(open)

  // reiniciar la selección cada vez que se abre el diálogo (patrón de ajuste en render)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setTripId(initialTripId ?? pendingTrips[0]?.id ?? null)
    setVehicleNumber(null)
  }

  const trip = pendingTrips.find((t) => t.id === tripId) ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CarTaxiFront className="h-5 w-5 text-amber-500" aria-hidden />
            Asignar pedido a un móvil
          </DialogTitle>
          <DialogDescription>
            Elegí el pedido y tocá el número de móvil. Atajos: F8 abre esta ventana.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[180px] space-y-2 overflow-y-auto rounded-lg border p-2">
          {pendingTrips.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-500">No hay pedidos pendientes</p>
          )}
          {pendingTrips.map((t) => (
            <button
              key={t.id}
              onClick={() => setTripId(t.id)}
              aria-pressed={tripId === t.id}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left text-sm',
                tripId === t.id ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50'
              )}
            >
              <span className="min-w-0">
                <span className="font-bold">#{t.code}</span> <span className="font-medium">{t.address}</span>
                <span className="ml-2 text-xs text-zinc-500">{t.passengerName}</span>
              </span>
              {t.scheduledAt && (
                <Badge variant="outline" className="shrink-0 border-amber-400 text-[10px] text-amber-700">
                  {formatTime(t.scheduledAt)}
                </Badge>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {vehicles.map((v) => {
            const state = vehicleState(v, positions)
            const selected = vehicleNumber === v.number
            const disabled = state === 'busy' || state === 'no-driver'
            return (
              <button
                key={v.id}
                disabled={disabled}
                onClick={() => setVehicleNumber(v.number)}
                aria-label={`Móvil ${v.number}, ${STATE_STYLES[state].label.toLowerCase()}`}
                className={cn(
                  'rounded-lg border p-2 text-center transition-colors',
                  selected ? 'border-amber-500 bg-amber-400 text-zinc-950' : '',
                  !selected && disabled && 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400',
                  !selected && !disabled && state === 'free' && 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
                  !selected && !disabled && state === 'offline' && 'border-zinc-200 bg-white hover:bg-zinc-100'
                )}
              >
                <span className="block text-lg font-black">{v.number}</span>
                <span className={cn('block truncate text-[9px] font-semibold', selected ? 'text-zinc-900' : 'text-zinc-500')}>
                  {state === 'free' ? 'LIBRE' : state === 'busy' ? 'OCUPADO' : state === 'offline' ? 'OFF' : 'S/C'}
                </span>
              </button>
            )
          })}
        </div>

        <Button
          className="h-12 w-full bg-amber-400 text-base font-black text-zinc-950 hover:bg-amber-300"
          disabled={!trip || vehicleNumber === null || assigning}
          onClick={() => trip && vehicleNumber !== null && onAssign(trip.id, vehicleNumber)}
        >
          {assigning ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : vehicleNumber !== null && trip ? (
            `ASIGNAR PEDIDO #${trip.code} AL MÓVIL ${vehicleNumber}`
          ) : (
            'Elegí pedido y móvil'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Tab principal del operador ----------

export function OperatorTab() {
  const queryClient = useQueryClient()
  const muted = useFleetStore((s) => s.muted)
  const positions = useFleetStore((s) => s.positions)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean
    tripId: string | null
  }>({ open: false, tripId: null })

  const vehiclesQ = useQuery<VehiclesResponse>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await fetch('/api/vehicles')
      if (!res.ok) throw new Error('Error al cargar la flota')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const tripsQ = useQuery<TripsResponse>({
    queryKey: ['trips', 'operator'],
    queryFn: async () => {
      const res = await fetch('/api/trips?status=PENDING,ASSIGNED,IN_PROGRESS&limit=300')
      if (!res.ok) throw new Error('Error al cargar los pedidos')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const pending = useMemo(() => {
    const list = tripsQ.data?.trips.filter((t) => t.status === 'PENDING') ?? []
    const now = Date.now()
    // urgentes primero: programados vencidos, luego programados, luego por número
    return [...list].sort((a, b) => {
      const aDue = isDue(a, now) ? 0 : 1
      const bDue = isDue(b, now) ? 0 : 1
      if (aDue !== bDue) return aDue - bDue
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      }
      if (a.scheduledAt) return -1
      if (b.scheduledAt) return 1
      return b.code - a.code
    })
  }, [tripsQ.data])

  const activeCount = useMemo(
    () => (tripsQ.data?.trips ?? []).filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length,
    [tripsQ.data]
  )
  const scheduledCount = useMemo(
    () => pending.filter((t) => t.scheduledAt && new Date(t.scheduledAt).getTime() > Date.now()).length,
    [pending]
  )
  const onlineCount = useMemo(
    () => Object.values(positions).filter((p) => p.online).length,
    [positions]
  )

  // Alerta sonora cuando un pedido programado llega a la hora
  const alertedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      for (const t of pending) {
        if (isDue(t, now) && !alertedRef.current.has(t.id)) {
          alertedRef.current.add(t.id)
          if (!muted) fleetAlarm.beepOnce()
          toast.warning(`Pedido programado #${t.code}: ¡llegó la hora!`, {
            description: `${t.address} - ${t.passengerName}. Asignalo con F8.`,
            duration: 12000,
          })
        }
      }
    }
    check()
    const timer = setInterval(check, 15000)
    return () => clearInterval(timer)
  }, [pending, muted])

  // Atajo F8: asignar el pedido seleccionado o el primero pendiente
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault()
        if (pending.length === 0) {
          toast.info('No hay pedidos pendientes para asignar')
          return
        }
        setAssignDialog({ open: true, tripId: selectedTripId ?? pending[0].id })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pending, selectedTripId])

  const invalidateFleet = () => {
    void queryClient.invalidateQueries({ queryKey: ['trips'] })
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
  }

  const assignMut = useMutation({
    mutationFn: async ({ tripId, vehicleNumber }: { tripId: string; vehicleNumber: number }) => {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'assign', vehicleNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo asignar el pedido')
      return data as TripResponse
    },
    onSuccess: (data) => {
      toast.success(`Pedido #${data.trip.code} asignado al móvil ${data.trip.vehicleNumber}`, {
        description: 'El chófer recibió la alarma en su panel.',
      })
      setAssignDialog({ open: false, tripId: null })
      setSelectedTripId(null)
      invalidateFleet()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const cancelMut = useMutation({
    mutationFn: async (tripId: string) => {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cancelar')
      return data as TripResponse
    },
    onSuccess: (data) => {
      toast.info(`Pedido #${data.trip.code} cancelado`)
      if (selectedTripId === data.trip.id) setSelectedTripId(null)
      invalidateFleet()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleTileClick = (vehicleNumber: number, state: VehicleState) => {
    if (!selectedTripId) {
      const v = vehiclesQ.data?.vehicles.find((x) => x.number === vehicleNumber)
      toast.info(`Móvil ${vehicleNumber}: ${STATE_STYLES[state].label}`, {
        description: v?.driver ? `${v.driver.name} - ${v.model} (${v.plate})` : 'Sin chofer asignado',
      })
      return
    }
    if (state === 'busy') {
      toast.error(`El móvil ${vehicleNumber} está ocupado`)
      return
    }
    if (state === 'no-driver') {
      toast.error(`El móvil ${vehicleNumber} no tiene chofer`)
      return
    }
    assignMut.mutate({ tripId: selectedTripId, vehicleNumber })
  }

  const vehicles = vehiclesQ.data?.vehicles ?? []
  const online = vehicles.filter((v) => positions[v.number]?.online).length

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Pendientes', value: pending.length, className: pending.length > 0 ? 'text-amber-600' : '' },
          { label: 'Programados', value: scheduledCount, className: '' },
          { label: 'En carrera', value: activeCount, className: '' },
          { label: 'Conectados', value: `${online}/20`, className: '' },
        ].map((s) => (
          <Card key={s.label} className="py-3">
            <CardContent className="px-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{s.label}</p>
              <p className={cn('text-2xl font-black', s.className)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        {/* Columna izquierda: cargar pedido + pendientes */}
        <div className="space-y-4">
          <TripForm />
          <PendingTrips
            trips={pending}
            selectedTripId={selectedTripId}
            onSelect={(id) => setSelectedTripId((cur) => (cur === id ? null : id))}
            onAssign={(tripId) => setAssignDialog({ open: true, tripId })}
            onCancel={(t) => cancelMut.mutate(t.id)}
            cancelingId={cancelMut.isPending ? cancelMut.variables ?? null : null}
          />
        </div>

        {/* Columna derecha: grilla de móviles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-amber-500" aria-hidden />
                Grilla de móviles
              </span>
              <span className="text-xs font-normal text-zinc-500">
                {selectedTripId
                  ? 'Pedido seleccionado: tocá un móvil libre para asignarlo'
                  : 'Tocá un pedido pendiente para habilitar la asignación por grilla'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vehiclesQ.isLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg bg-zinc-200" />
                ))}
              </div>
            ) : (
              <VehicleGrid
                vehicles={vehicles}
                selectedTripId={selectedTripId}
                onTileClick={handleTileClick}
              />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Libre y conectado</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> En carrera</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Desconectado</span>
              <span className="flex items-center gap-1.5"><X className="h-3 w-3" /> F8 = asignar</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <AssignDialog
        open={assignDialog.open}
        onOpenChange={(v) => setAssignDialog({ open: v, tripId: v ? assignDialog.tripId : null })}
        pendingTrips={pending}
        vehicles={vehicles}
        initialTripId={assignDialog.tripId}
        onAssign={(tripId, vehicleNumber) => assignMut.mutate({ tripId, vehicleNumber })}
        assigning={assignMut.isPending}
      />
    </div>
  )
}
