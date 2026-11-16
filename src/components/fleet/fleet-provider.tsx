// Provider raíz: QueryClient + puente socket <-> store + alarma sonora
// Tiene dos modos de transporte, con el mismo comportamiento para la UI:
//  - WebSocket (fleet-service): usado por defecto (sandbox/desarrollo).
//  - Sondeo HTTP (/api/fleet/sync): entra automáticamente cuando el socket no
//    está disponible (p. ej. Vercel serverless, donde no hay WebSocket).
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { getFleetSocket, fleetSocketDisabled } from '@/lib/socket'
import { fleetAlarm } from '@/lib/alarm'
import { useFleetStore } from '@/lib/store'
import type { TripDTO, VehiclePos } from '@/lib/types'

const POLL_INTERVAL_MS = 2500

function FleetSocketBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const store = useFleetStore.getState()
    store.hydrate()

    // desbloquear audio con el primer gesto del usuario
    const unlock = () => fleetAlarm.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })

    const invalidate = (keys: string[]) => {
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
    }

    // --- dedup de avisos: socket y sondeo pueden anunciar el mismo evento ---
    const seen = new Map<string, number>()
    const once = (key: string, ttlMs = 60_000): boolean => {
      const now = Date.now()
      for (const [k, exp] of seen) {
        if (exp <= now) seen.delete(k)
      }
      const current = seen.get(key)
      if (current && current > now) return false
      seen.set(key, now + ttlMs)
      return true
    }

    // ---------- manejadores compartidos por ambos transportes ----------
    const onVehicleOnline = (vehicleNumber: number) => {
      useFleetStore.getState().patchPosition({ number: vehicleNumber, online: true })
      invalidate(['vehicles'])
    }

    const onVehicleOffline = (vehicleNumber: number) => {
      useFleetStore.getState().patchPosition({ number: vehicleNumber, online: false, busy: false, phase: 'idle' })
      invalidate(['vehicles'])
    }

    const onTripNew = (trip: TripDTO) => {
      invalidate(['trips'])
      const st = useFleetStore.getState()
      if (!st.muted && once(`beep:new:${trip.id}`)) fleetAlarm.beepOnce()
      if (once(`toast:new:${trip.id}`)) {
        toast.info(`Nuevo pedido #${trip.code}`, {
          description: `${trip.address}${trip.scheduledAt ? ' - programado' : ''}`,
        })
      }
    }

    const onTripAssigned = (trip: TripDTO) => {
      invalidate(['trips', 'vehicles'])
      const st = useFleetStore.getState()
      if (st.selectedDriver && trip.vehicleNumber === st.selectedDriver.vehicleNumber) {
        st.setIncomingTrip(trip)
      }
      if (once(`toast:assigned:${trip.id}`)) {
        toast.success(`Pedido #${trip.code} asignado al móvil ${trip.vehicleNumber}`, {
          description: trip.address,
        })
      }
    }

    const onTripAck = (tripId: string) => {
      invalidate(['trips'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === tripId) {
        st.setIncomingTrip(null)
      }
    }

    const onTripStatus = (tripId: string, status: string, code?: number) => {
      invalidate(['trips', 'vehicles'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === tripId) {
        st.setIncomingTrip(null)
      }
      if (status === 'IN_PROGRESS' && once(`toast:progress:${tripId}`)) {
        toast.info(`Pedido #${code ?? ''} en curso`, {
          description: 'El chófer ya fue por el pasajero.',
        })
      }
    }

    const onTripCompleted = (trip: TripDTO) => {
      invalidate(['trips', 'vehicles', 'drivers', 'payments'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === trip.id) st.setIncomingTrip(null)
      if (once(`toast:completed:${trip.id}`)) {
        toast.success(`Pedido #${trip.code} completado`, {
          description: trip.address,
        })
      }
    }

    const onTripCancelled = (tripId: string) => {
      invalidate(['trips', 'vehicles'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === tripId) st.setIncomingTrip(null)
    }

    // ---------------- transporte 1: WebSocket (fleet service) ----------------
    const socketDisabled = fleetSocketDisabled()
    const socketUp = { value: false }
    let socket: ReturnType<typeof getFleetSocket> | null = null

    if (!socketDisabled) {
      socket = getFleetSocket()

      const onConnect = () => {
        socketUp.value = true
        useFleetStore.getState().setSocketConnected(true)
        // pedir estado inicial de posiciones
        socket?.emit('state:get', (data: { ts: number; vehicles: VehiclePos[] } | undefined) => {
          if (data?.vehicles) {
            useFleetStore.getState().setPositions(data.vehicles, data.ts)
          }
        })
        // si el chófer seleccionado estaba conectado antes de recargar, reconectar
        const st = useFleetStore.getState()
        if (st.selectedDriver && st.driverOnline) {
          socket?.emit('driver:online', {
            vehicleNumber: st.selectedDriver.vehicleNumber,
            driverName: st.selectedDriver.name,
          })
        }
        invalidate(['vehicles'])
      }

      const onDisconnect = () => {
        socketUp.value = false
        useFleetStore.getState().setSocketConnected(false)
      }

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('positions', (data: { ts: number; vehicles: VehiclePos[] }) => {
        if (data?.vehicles) useFleetStore.getState().setPositions(data.vehicles, data.ts)
      })
      socket.on('vehicle:online', (d: { vehicleNumber: number }) => onVehicleOnline(d.vehicleNumber))
      socket.on('vehicle:offline', (d: { vehicleNumber: number }) => onVehicleOffline(d.vehicleNumber))
      socket.on('trip:new', (d: { trip: TripDTO }) => onTripNew(d.trip))
      socket.on('trip:assigned', (d: { trip: TripDTO; vehicleNumber: number }) => onTripAssigned(d.trip))
      socket.on('trip:ack', (d: { tripId: string }) => onTripAck(d.tripId))
      socket.on('trip:status', (d: { tripId: string; status: string }) => onTripStatus(d.tripId, d.status))
      socket.on('trip:completed', (d: { trip: TripDTO }) => onTripCompleted(d.trip))
      socket.on('trip:cancelled', (d: { tripId: string }) => onTripCancelled(d.tripId))

      // si el socket ya estaba conectado (HMR), forzar estado
      if (socket.connected) onConnect()
    }

    // ------------- transporte 2: sondeo HTTP (fallback serverless) -------------
    // Sondea siempre que esté corriendo; cada tick se omite si el socket está
    // activo. Detecta novedades comparando los viajes con la pasada anterior.
    interface PrevTrip {
      status: string
      vehicleNumber: number | null
      acked: boolean
    }
    const prev = new Map<string, PrevTrip>()
    let firstPoll = true

    const applyTrip = (trip: TripDTO, silentNew: boolean) => {
      const before = prev.get(trip.id) ?? null
      if (!before) {
        if (trip.status === 'PENDING') {
          if (!silentNew) onTripNew(trip)
        } else if (trip.status === 'ASSIGNED') {
          // al recargar la página solo se repite la alarma si el chófer aún no atendió
          if (!trip.acknowledgedAt) onTripAssigned(trip)
        }
      } else if (before.status !== trip.status) {
        if (trip.status === 'ASSIGNED') onTripAssigned(trip)
        else if (trip.status === 'IN_PROGRESS') onTripStatus(trip.id, trip.status, trip.code)
        else if (trip.status === 'COMPLETED') onTripCompleted(trip)
        else if (trip.status === 'CANCELLED') onTripCancelled(trip.id)
      }
      prev.set(trip.id, {
        status: trip.status,
        vehicleNumber: trip.vehicleNumber,
        acked: Boolean(trip.acknowledgedAt),
      })
    }

    const poll = async () => {
      if (socketUp.value) return
      try {
        const res = await fetch('/api/fleet/sync', { cache: 'no-store' })
        if (!res.ok) throw new Error(`sync ${res.status}`)
        const data = (await res.json()) as { ts: number; positions: VehiclePos[]; trips: TripDTO[] }

        useFleetStore.getState().setSocketConnected(true)
        if (!socketUp.value && data.positions) {
          useFleetStore.getState().setPositions(data.positions, data.ts)
        }
        for (const trip of data.trips ?? []) {
          applyTrip(trip, firstPoll)
        }
        firstPoll = false
      } catch {
        if (!socketUp.value) useFleetStore.getState().setSocketConnected(false)
      }
    }

    const pollTimer = setInterval(() => {
      void poll()
    }, POLL_INTERVAL_MS)
    void poll()

    return () => {
      if (socket) {
        socket.off('connect')
        socket.off('disconnect')
        socket.off('positions')
        socket.off('vehicle:online')
        socket.off('vehicle:offline')
        socket.off('trip:new')
        socket.off('trip:assigned')
        socket.off('trip:ack')
        socket.off('trip:status')
        socket.off('trip:completed')
        socket.off('trip:cancelled')
      }
      clearInterval(pollTimer)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [queryClient])

  return <>{children}</>
}

export function FleetProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <FleetSocketBridge>{children}</FleetSocketBridge>
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  )
}
