// Panel del chófer: conectar/desconectar, recibir pedidos (alarma) y cerrar el viaje con cobro
'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Banknote,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Power,
  RadioTower,
  Satellite,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatARSPlain, formatTime } from '@/lib/format'
import { useFleetStore } from '@/lib/store'
import { getFleetSocket } from '@/lib/socket'
import type { DriverWithStatsDTO, PaymentMethod, TripDTO } from '@/lib/types'

type DriversResponse = { drivers: DriverWithStatsDTO[] }
type TripsResponse = { trips: TripDTO[] }
type TripResponse = { trip: TripDTO }

const METHOD_OPTIONS: { method: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { method: 'CASH', label: 'Efectivo', icon: Banknote },
  { method: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { method: 'TRANSFER', label: 'Transferencia', icon: ArrowLeftRight },
]

export function DriverTab() {
  const queryClient = useQueryClient()
  const selectedDriver = useFleetStore((s) => s.selectedDriver)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const driverOnline = useFleetStore((s) => s.driverOnline)
  const setDriverOnline = useFleetStore((s) => s.setDriverOnline)
  const incomingTrip = useFleetStore((s) => s.incomingTrip)
  const positions = useFleetStore((s) => s.positions)

  const [realGps, setRealGps] = useState(false)
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null)
  const [payDialog, setPayDialog] = useState<{ open: boolean; amount: string; method: PaymentMethod }>({
    open: false,
    amount: '',
    method: 'CASH',
  })

  const driversQ = useQuery<DriversResponse>({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await fetch('/api/drivers')
      if (!res.ok) throw new Error('Error al cargar los choferes')
      return res.json()
    },
  })

  // Viajes activos del móvil del chófer seleccionado
  const myTripsQ = useQuery<TripsResponse>({
    queryKey: ['trips', 'driver', selectedDriver?.vehicleNumber ?? 'none'],
    queryFn: async () => {
      const n = useFleetStore.getState().selectedDriver?.vehicleNumber
      if (!n) return { trips: [] }
      const res = await fetch(`/api/trips?status=ASSIGNED,IN_PROGRESS&vehicleNumber=${n}&limit=10`)
      if (!res.ok) throw new Error('Error al cargar los pedidos')
      return res.json()
    },
    refetchInterval: 10000,
    enabled: !!selectedDriver,
  })

  const myTrip: TripDTO | null = useMemo(() => {
    const list = myTripsQ.data?.trips ?? []
    return list.find((t) => t.status === 'ASSIGNED' && !t.acknowledgedAt) ?? list[0] ?? null
  }, [myTripsQ.data])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['trips'] })
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
  }

  const connectMut = useMutation({
    mutationFn: async () => {
      // la presencia va por socket; el estado local se maneja en el cliente
      await new Promise((r) => setTimeout(r, 150))
    },
    onMutate: () => {
      if (!selectedDriver) return
      const socket = getFleetSocket()
      socket.emit('driver:online', {
        vehicleNumber: selectedDriver.vehicleNumber,
        driverName: selectedDriver.name,
      })
      setDriverOnline(true)
      toast.success(`Móvil ${selectedDriver.vehicleNumber} conectado`, {
        description: 'Ya estás en la grilla de la operadora. Esperá los pedidos.',
      })
    },
  })

  const disconnect = () => {
    if (!selectedDriver) return
    const socket = getFleetSocket()
    socket.emit('driver:offline', { vehicleNumber: selectedDriver.vehicleNumber })
    setDriverOnline(false)
    toast.info(`Móvil ${selectedDriver.vehicleNumber} desconectado`)
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId)
      setGpsWatchId(null)
    }
  }

  // GPS real (opcional): reporta la posición del celular al sistema
  const toggleRealGps = (on: boolean) => {
    setRealGps(on)
    if (!on) {
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId)
        setGpsWatchId(null)
      }
      return
    }
    if (!('geolocation' in navigator)) {
      toast.error('Este dispositivo no soporta GPS')
      setRealGps(false)
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!selectedDriver) return
        getFleetSocket().emit('gps:update', {
          vehicleNumber: selectedDriver.vehicleNumber,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
        })
      },
      () => {
        toast.error('No se pudo acceder al GPS. Revisá los permisos.')
        setRealGps(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    setGpsWatchId(id)
    toast.success('GPS real activado: se reporta tu posición al sistema')
  }

  const ackMut = useMutation({
    mutationFn: async (trip: TripDTO) => {
      getFleetSocket().emit('trip:ack', { tripId: trip.id, vehicleNumber: trip.vehicleNumber })
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ack' }),
      })
      if (!res.ok) throw new Error('No se pudo confirmar el pedido')
      return (await res.json()) as TripResponse
    },
    onSuccess: () => {
      toast.success('Pedido atendido', { description: 'Ya podés ir por el pasajero.' })
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const startMut = useMutation({
    mutationFn: async (tripId: string) => {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar el viaje')
      return data as TripResponse
    },
    onSuccess: () => {
      toast.success('Viaje iniciado: pasajero a bordo')
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const completeMut = useMutation({
    mutationFn: async ({ tripId, amount, method }: { tripId: string; amount: number; method: PaymentMethod }) => {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'complete', amount, paymentMethod: method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo finalizar el viaje')
      return data as TripResponse
    },
    onSuccess: (data) => {
      toast.success(`Viaje #${data.trip.code} finalizado`, {
        description: `Cobraste ${formatARSPlain(data.trip.fare)} (${data.trip.paymentMethod === 'CASH' ? 'efectivo' : data.trip.paymentMethod === 'CARD' ? 'tarjeta' : 'transferencia'}).`,
      })
      setPayDialog({ open: false, amount: '', method: 'CASH' })
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const myPos = selectedDriver ? positions[selectedDriver.vehicleNumber] : null

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* Panel izquierdo: conexión */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTower className="h-4 w-4 text-amber-500" aria-hidden />
              Panel del chófer
            </CardTitle>
            <CardDescription>Elegí tu nombre y conectate para recibir pedidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="driver-select">Chofer</Label>
              <Select
                value={selectedDriver?.id ?? 'none'}
                onValueChange={(id) => {
                  if (driverOnline) {
                    disconnect()
                  }
                  const d = driversQ.data?.drivers.find((x) => x.id === id)
                  if (d && d.vehicleNumber) {
                    setSelectedDriver({ id: d.id, name: d.name, vehicleNumber: d.vehicleNumber })
                  } else if (d) {
                    setSelectedDriver(null)
                    toast.error(`${d.name} no tiene móvil asignado. Avisá a la operadora.`)
                  }
                }}
                disabled={driversQ.isLoading}
              >
                <SelectTrigger id="driver-select" aria-label="Elegir chofer">
                  <SelectValue placeholder="Elegí tu nombre" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none" disabled>- Elegí tu nombre -</SelectItem>
                  {driversQ.data?.drivers
                    .filter((d) => d.active)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} {d.vehicleNumber ? `- Móvil ${d.vehicleNumber}` : '(sin móvil)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDriver ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                <p className="text-4xl font-black text-zinc-900">#{selectedDriver.vehicleNumber}</p>
                <p className="text-sm font-semibold text-zinc-700">{selectedDriver.name}</p>
                <Badge
                  className={cn(
                    'mt-2',
                    driverOnline ? 'bg-emerald-500 text-white' : 'bg-zinc-300 text-zinc-600'
                  )}
                >
                  {driverOnline ? 'CONECTADO' : 'DESCONECTADO'}
                </Badge>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                Primero elegí tu nombre en la lista de arriba
              </p>
            )}

            {selectedDriver && !driverOnline && (
              <Button
                size="lg"
                disabled={connectMut.isPending}
                onClick={() => connectMut.mutate()}
                className="h-16 w-full bg-emerald-500 text-lg font-black text-zinc-950 hover:bg-emerald-400"
              >
                <Power className="h-6 w-6" aria-hidden />
                CONECTAR AL SISTEMA
              </Button>
            )}
            {selectedDriver && driverOnline && (
              <Button
                size="lg"
                variant="destructive"
                onClick={disconnect}
                className="h-16 w-full text-lg font-black"
              >
                <Power className="h-6 w-6" aria-hidden />
                DESCONECTAR
              </Button>
            )}

            {selectedDriver && (
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
                <label htmlFor="real-gps" className="flex items-center gap-2 text-sm">
                  <Satellite className="h-4 w-4 text-amber-500" aria-hidden />
                  <span className="font-medium">GPS real del celular</span>
                </label>
                <Switch
                  id="real-gps"
                  checked={realGps}
                  onCheckedChange={toggleRealGps}
                  disabled={!driverOnline}
                  aria-label="Activar GPS real del celular"
                />
              </div>
            )}

            <p className="text-center text-xs text-zinc-500">
              {realGps
                ? 'Reportando tu ubicación real al sistema.'
                : 'GPS demo: tu móvil se ve en la zona con posición simulada. Cuando la app del celular tenga permisos, activá GPS real.'}
            </p>
          </CardContent>
        </Card>

        {selectedDriver && driverOnline && (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-6">
              <span className="relative flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
              </span>
              <p className="text-lg font-bold text-zinc-800">
                {incomingTrip || myTrip ? '¡Atendé el pedido!' : 'Esperando pedidos...'}
              </p>
              {myPos && (
                <span className="ml-auto font-mono text-xs text-zinc-400">
                  {myPos.lat.toFixed(4)}, {myPos.lng.toFixed(4)}
                </span>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Panel derecho: viaje actual */}
      <div className="space-y-4">
        {!selectedDriver && (
          <Card className="flex min-h-[320px] items-center justify-center">
            <CardContent className="text-center text-zinc-500">
              <RadioTower className="mx-auto mb-3 h-10 w-10 text-zinc-300" aria-hidden />
              <p className="text-lg font-semibold">Conectate para ver tus pedidos</p>
              <p className="mt-1 text-sm">El pedido te va a sonar y aparecer acá, grande y claro.</p>
            </CardContent>
          </Card>
        )}

        {selectedDriver && myTrip && (
          <Card className="overflow-hidden border-2">
            <div
              className={cn(
                'flex items-center justify-between px-5 py-3 text-zinc-950',
                myTrip.status === 'IN_PROGRESS' ? 'bg-zinc-900 text-amber-400' : 'bg-amber-400'
              )}
            >
              <p className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                {myTrip.status === 'IN_PROGRESS' ? (
                  <>
                    <Navigation className="h-5 w-5" aria-hidden /> En viaje con el pasajero
                  </>
                ) : myTrip.acknowledgedAt ? (
                  <>
                    <Navigation className="h-5 w-5" aria-hidden /> En camino al pasajero
                  </>
                ) : (
                  <>
                    <BellRing className="h-5 w-5 animate-bounce" aria-hidden /> ¡Nuevo pedido!
                  </>
                )}
              </p>
              <span className="text-sm font-bold">Pedido #{myTrip.code}</span>
            </div>

            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Dirección</p>
                <p className="mt-1 text-3xl font-extrabold leading-tight text-zinc-900">{myTrip.address}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {myTrip.zone && <Badge variant="outline">Zona: {myTrip.zone}</Badge>}
                  {myTrip.scheduledAt && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700">
                      <CalendarClock className="mr-1 h-3 w-3" aria-hidden />
                      Programado {formatTime(myTrip.scheduledAt)}
                    </Badge>
                  )}
                  {myTrip.fare > 0 && (
                    <Badge className="bg-zinc-900 text-amber-400">{formatARSPlain(myTrip.fare)}</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-zinc-700">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-zinc-400" aria-hidden />
                  <span className="font-medium">{myTrip.passengerName}</span>
                </span>
                {myTrip.passengerPhone && (
                  <a
                    href={`tel:${myTrip.passengerPhone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:text-amber-600"
                  >
                    <Phone className="h-4 w-4 text-zinc-400" aria-hidden />
                    {myTrip.passengerPhone}
                  </a>
                )}
              </div>

              {myTrip.notes && (
                <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 border border-amber-200">
                  Nota: {myTrip.notes}
                </p>
              )}

              {!myTrip.acknowledgedAt && myTrip.status === 'ASSIGNED' && (
                <Button
                  size="lg"
                  disabled={ackMut.isPending}
                  onClick={() => ackMut.mutate(myTrip)}
                  className="h-16 w-full bg-emerald-500 text-xl font-black text-zinc-950 hover:bg-emerald-400"
                >
                  {ackMut.isPending ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <CheckCircle2 className="h-6 w-6" aria-hidden />}
                  ATENDIDO - YA VOY
                </Button>
              )}

              {myTrip.acknowledgedAt && myTrip.status === 'ASSIGNED' && (
                <Button
                  size="lg"
                  disabled={startMut.isPending}
                  onClick={() => startMut.mutate(myTrip.id)}
                  className="h-16 w-full bg-amber-400 text-xl font-black text-zinc-950 hover:bg-amber-300"
                >
                  {startMut.isPending ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <User className="h-6 w-6" aria-hidden />}
                  PASAJERO A BORDO
                </Button>
              )}

              {myTrip.status === 'IN_PROGRESS' && (
                <Button
                  size="lg"
                  onClick={() =>
                    setPayDialog({
                      open: true,
                      amount: myTrip.fare > 0 ? String(myTrip.fare) : '',
                      method: 'CASH',
                    })
                  }
                  className="h-16 w-full bg-zinc-900 text-xl font-black text-amber-400 hover:bg-zinc-800"
                >
                  <CheckCircle2 className="h-6 w-6" aria-hidden />
                  FINALIZAR VIAJE Y COBRAR
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {selectedDriver && driverOnline && !myTrip && !incomingTrip && (
          <Card className="flex min-h-[280px] items-center justify-center border-dashed">
            <CardContent className="text-center">
              <MapPin className="mx-auto mb-3 h-10 w-10 text-zinc-300" aria-hidden />
              <p className="text-lg font-semibold text-zinc-700">No tenés pedidos asignados</p>
              <p className="mt-1 text-sm text-zinc-500">
                Cuando la operadora te asigne uno, va a sonar la alarma y verás la dirección acá.
              </p>
            </CardContent>
          </Card>
        )}

        {selectedDriver && !driverOnline && (
          <Card className="flex min-h-[280px] items-center justify-center border-dashed">
            <CardContent className="text-center text-zinc-500">
              <p className="text-lg font-semibold">Estás desconectado</p>
              <p className="mt-1 text-sm">Tocá CONECTAR AL SISTEMA para recibir pedidos.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diálogo de cobro */}
      <Dialog open={payDialog.open} onOpenChange={(v) => setPayDialog((s) => ({ ...s, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-500" aria-hidden />
              Cobro del viaje
            </DialogTitle>
            <DialogDescription>Confirmá el monto y el método de pago</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto cobrado ($)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step={50}
                placeholder="0"
                value={payDialog.amount}
                onChange={(e) => setPayDialog((s) => ({ ...s, amount: e.target.value }))}
                className="h-12 text-lg font-bold"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {METHOD_OPTIONS.map((m) => {
                const Icon = m.icon
                const selected = payDialog.method === m.method
                return (
                  <button
                    key={m.method}
                    onClick={() => setPayDialog((s) => ({ ...s, method: m.method }))}
                    aria-pressed={selected}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-colors',
                      selected ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    <Icon className={cn('h-7 w-7', selected ? 'text-amber-600' : 'text-zinc-400')} aria-hidden />
                    <span className={cn('text-sm font-bold', selected ? 'text-amber-700' : 'text-zinc-600')}>{m.label}</span>
                  </button>
                )
              })}
            </div>
            <Button
              size="lg"
              className="h-14 w-full bg-emerald-500 text-lg font-black text-zinc-950 hover:bg-emerald-400"
              disabled={completeMut.isPending || !payDialog.amount || Number(payDialog.amount) <= 0}
              onClick={() => {
                if (!myTrip) return
                completeMut.mutate({
                  tripId: myTrip.id,
                  amount: Number(payDialog.amount),
                  method: payDialog.method,
                })
              }}
            >
              {completeMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-5 w-5" aria-hidden />}
              CONFIRMAR COBRO Y FINALIZAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
