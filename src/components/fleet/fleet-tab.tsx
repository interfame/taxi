// Gestión de flota: choferes con sus móviles, estado, estadísticas y edición
'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  CarTaxiFront,
  IdCard,
  Loader2,
  Phone,
  Plus,
  Settings2,
  UserRound,
  Wallet,
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
import { formatARSPlain } from '@/lib/format'
import { useFleetStore } from '@/lib/store'
import type { DriverWithStatsDTO, VehicleDTO } from '@/lib/types'

type DriversResponse = { drivers: DriverWithStatsDTO[] }
type VehiclesResponse = { vehicles: VehicleDTO[] }

export function FleetTab() {
  const queryClient = useQueryClient()
  const positions = useFleetStore((s) => s.positions)

  const driversQ = useQuery<DriversResponse>({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await fetch('/api/drivers')
      if (!res.ok) throw new Error('Error al cargar los choferes')
      return res.json()
    },
  })

  const vehiclesQ = useQuery<VehiclesResponse>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await fetch('/api/vehicles')
      if (!res.ok) throw new Error('Error al cargar los móviles')
      return res.json()
    },
  })

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<DriverWithStatsDTO | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['drivers'] })
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    void queryClient.invalidateQueries({ queryKey: ['trips'] })
  }

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/drivers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar el chofer')
      return res.json() as Promise<DriversResponse>
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? 'Chofer activado' : 'Chofer desactivado')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totals = useMemo(() => {
    const drivers = driversQ.data?.drivers ?? []
    return {
      active: drivers.filter((d) => d.active).length,
      connected: drivers.filter((d) => d.vehicleNumber && positions[d.vehicleNumber]?.online).length,
      earned: drivers.reduce((acc, d) => acc + d.earned, 0),
      trips: drivers.reduce((acc, d) => acc + d.completedTrips, 0),
    }
  }, [driversQ.data, positions])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-900">Choferes de la flota</h2>
          <p className="text-sm text-zinc-500">
            {totals.active} activos - {totals.connected} conectados ahora - {totals.trips} viajes completados -{' '}
            {formatARSPlain(totals.earned)} facturado
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-amber-400 font-bold text-zinc-950 hover:bg-amber-300"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo chofer
        </Button>
      </div>

      {driversQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-zinc-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {driversQ.data?.drivers.map((d) => {
            const online = d.vehicleNumber ? !!positions[d.vehicleNumber]?.online : false
            const busy = d.vehicleNumber ? !!positions[d.vehicleNumber]?.busy : false
            const state = !d.active
              ? { label: 'Inactivo', cls: 'bg-zinc-300 text-zinc-600' }
              : online && busy
                ? { label: 'En carrera', cls: 'bg-amber-400 text-zinc-950' }
                : online
                  ? { label: 'Conectado', cls: 'bg-emerald-500 text-white' }
                  : { label: 'Desconectado', cls: 'bg-zinc-400 text-white' }
            return (
              <Card key={d.id} className={cn('py-4', !d.active && 'opacity-60')}>
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-black text-amber-400">
                        {d.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="font-bold leading-tight text-zinc-900">{d.name}</p>
                        <p className="flex items-center gap-1 text-xs text-zinc-500">
                          <Phone className="h-3 w-3" aria-hidden />
                          {d.phone}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-zinc-500">
                          <IdCard className="h-3 w-3" aria-hidden />
                          Lic. {d.license}
                        </p>
                      </div>
                    </div>
                    <Badge className={state.cls}>{state.label}</Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                      <CarTaxiFront className="h-4 w-4 text-amber-500" aria-hidden />
                      {d.vehicleNumber ? `Móvil ${d.vehicleNumber}` : 'Sin móvil'}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {d.vehicleModel ? `${d.vehicleModel} - ${d.vehiclePlate}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <BadgeCheck className="h-4 w-4 text-emerald-500" aria-hidden />
                      {d.completedTrips} viajes
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-zinc-900">
                      <Wallet className="h-4 w-4 text-amber-500" aria-hidden />
                      {formatARSPlain(d.earned)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-600" htmlFor={`active-${d.id}`}>
                      <Switch
                        id={`active-${d.id}`}
                        checked={d.active}
                        onCheckedChange={(v) => toggleMut.mutate({ id: d.id, active: v })}
                        disabled={toggleMut.isPending}
                        aria-label={`Activar o desactivar a ${d.name}`}
                      />
                      {d.active ? 'Activo' : 'Inactivo'}
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(d)}
                      className="gap-1.5"
                      aria-label={`Editar a ${d.name}`}
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden />
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddDriverDialog open={addOpen} onOpenChange={setAddOpen} vehicles={vehiclesQ.data?.vehicles ?? []} onDone={invalidate} />
      <EditDriverDialog driver={editing} onOpenChange={(v) => !v && setEditing(null)} vehicles={vehiclesQ.data?.vehicles ?? []} onDone={invalidate} />
    </div>
  )
}

function VehicleSelect({
  value,
  onValueChange,
  vehicles,
  allowNone = true,
  disabledIds = [],
  id,
}: {
  value: string
  onValueChange: (v: string) => void
  vehicles: VehicleDTO[]
  allowNone?: boolean
  disabledIds?: number[]
  id: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label="Asignar móvil">
        <SelectValue placeholder="Móvil" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {allowNone && <SelectItem value="none">Sin móvil</SelectItem>}
        {vehicles.map((v) => (
          <SelectItem key={v.id} value={String(v.number)} disabled={disabledIds.includes(v.number)}>
            Móvil {v.number} {v.driver ? `- ${v.driver.name}` : '- libre'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AddDriverDialog({
  open,
  onOpenChange,
  vehicles,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  vehicles: VehicleDTO[]
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [license, setLicense] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('none')

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          license,
          vehicleNumber: vehicleNumber !== 'none' ? Number(vehicleNumber) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear el chofer')
      return data
    },
    onSuccess: () => {
      toast.success('Chofer agregado')
      setName('')
      setPhone('')
      setLicense('')
      setVehicleNumber('none')
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-amber-500" aria-hidden />
            Nuevo chofer
          </DialogTitle>
          <DialogDescription>Cargá los datos y, si querés, asignale un móvil libre</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-driver-name">Nombre y apellido *</Label>
            <Input id="new-driver-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-driver-phone">Teléfono *</Label>
              <Input id="new-driver-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-driver-license">Licencia *</Label>
              <Input id="new-driver-license" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="D1-..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Móvil asignado</Label>
            <VehicleSelect
              id="new-driver-vehicle"
              value={vehicleNumber}
              onValueChange={setVehicleNumber}
              vehicles={vehicles.filter((v) => !v.driver)}
            />
          </div>
          <Button
            className="w-full bg-amber-400 font-bold text-zinc-950 hover:bg-amber-300"
            disabled={createMut.isPending || !name.trim() || !phone.trim() || !license.trim()}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Agregar chofer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditDriverDialog({
  driver,
  onOpenChange,
  vehicles,
  onDone,
}: {
  driver: DriverWithStatsDTO | null
  onOpenChange: (v: boolean) => void
  vehicles: VehicleDTO[]
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [license, setLicense] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('none')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // sincronizar el formulario al abrir
  if (driver && loadedFor !== driver.id) {
    setLoadedFor(driver.id)
    setName(driver.name)
    setPhone(driver.phone)
    setLicense(driver.license)
    setVehicleNumber(driver.vehicleNumber ? String(driver.vehicleNumber) : 'none')
  }
  if (!driver && loadedFor) {
    setLoadedFor(null)
  }

  const freeVehicles = useMemo(
    () => vehicles.filter((v) => !v.driver || driver?.vehicleNumber === v.number),
    [vehicles, driver]
  )
  const takenByOthers = useMemo(
    () => vehicles.filter((v) => v.driver && driver?.vehicleNumber !== v.number).map((v) => v.number),
    [vehicles, driver]
  )

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!driver) throw new Error('Sin chofer')
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          license,
          vehicleNumber: vehicleNumber !== 'none' ? Number(vehicleNumber) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo actualizar')
      return data
    },
    onSuccess: () => {
      toast.success('Chofer actualizado')
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={!!driver} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-amber-500" aria-hidden />
            Editar chofer
          </DialogTitle>
          <DialogDescription>Modificá los datos o cambiá el móvil asignado</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-driver-name">Nombre</Label>
            <Input id="edit-driver-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-driver-phone">Teléfono</Label>
              <Input id="edit-driver-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-driver-license">Licencia</Label>
              <Input id="edit-driver-license" value={license} onChange={(e) => setLicense(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Móvil asignado</Label>
            <VehicleSelect
              id="edit-driver-vehicle"
              value={vehicleNumber}
              onValueChange={setVehicleNumber}
              vehicles={freeVehicles}
              disabledIds={takenByOthers}
            />
          </div>
          <Button
            className="w-full bg-amber-400 font-bold text-zinc-950 hover:bg-amber-300"
            disabled={saveMut.isPending || !name.trim() || !phone.trim() || !license.trim()}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
