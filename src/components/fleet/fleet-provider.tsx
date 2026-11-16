// Provider raíz: QueryClient + puente socket <-> store + alarma sonora
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { getFleetSocket } from '@/lib/socket'
import { fleetAlarm } from '@/lib/alarm'
import { useFleetStore } from '@/lib/store'
import type { TripDTO, VehiclePos } from '@/lib/types'

function FleetSocketBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const store = useFleetStore.getState()
    store.hydrate()

    // desbloquear audio con el primer gesto del usuario
    const unlock = () => fleetAlarm.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })

    const socket = getFleetSocket()

    const invalidate = (keys: string[]) => {
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
    }

    const onConnect = () => {
      useFleetStore.getState().setSocketConnected(true)
      // pedir estado inicial de posiciones
      socket.emit('state:get', (data: { ts: number; vehicles: VehiclePos[] } | undefined) => {
        if (data?.vehicles) {
          useFleetStore.getState().setPositions(data.vehicles, data.ts)
        }
      })
      // si el chófer seleccionado estaba conectado antes de recargar, reconectar
      const st = useFleetStore.getState()
      if (st.selectedDriver && st.driverOnline) {
        socket.emit('driver:online', {
          vehicleNumber: st.selectedDriver.vehicleNumber,
          driverName: st.selectedDriver.name,
        })
      }
      invalidate(['vehicles'])
    }

    const onDisconnect = () => {
      useFleetStore.getState().setSocketConnected(false)
    }

    const onPositions = (data: { ts: number; vehicles: VehiclePos[] }) => {
      if (data?.vehicles) {
        useFleetStore.getState().setPositions(data.vehicles, data.ts)
      }
    }

    const onVehicleOnline = (d: { vehicleNumber: number }) => {
      useFleetStore.getState().patchPosition({ number: d.vehicleNumber, online: true })
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    }

    const onVehicleOffline = (d: { vehicleNumber: number }) => {
      useFleetStore.getState().patchPosition({ number: d.vehicleNumber, online: false, busy: false, phase: 'idle' })
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    }

    const onTripNew = (d: { trip: TripDTO }) => {
      invalidate(['trips'])
      const st = useFleetStore.getState()
      if (!st.muted) fleetAlarm.beepOnce()
      toast.info(`Nuevo pedido #${d.trip.code}`, {
        description: `${d.trip.address}${d.trip.scheduledAt ? ' - programado' : ''}`,
      })
    }

    const onTripAssigned = (d: { trip: TripDTO; vehicleNumber: number }) => {
      invalidate(['trips', 'vehicles'])
      const st = useFleetStore.getState()
      if (st.selectedDriver && d.vehicleNumber === st.selectedDriver.vehicleNumber) {
        st.setIncomingTrip(d.trip)
      }
      toast.success(`Pedido #${d.trip.code} asignado al móvil ${d.vehicleNumber}`, {
        description: d.trip.address,
      })
    }

    const onTripAck = (d: { tripId: string; vehicleNumber: number }) => {
      invalidate(['trips'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === d.tripId) {
        st.setIncomingTrip(null)
      }
    }

    const onTripStatus = (d: { tripId: string; status: string; vehicleNumber: number | null }) => {
      invalidate(['trips', 'vehicles'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === d.tripId) {
        st.setIncomingTrip(null)
      }
    }

    const onTripCompleted = (d: { trip: TripDTO; payment: { amount: number }; vehicleNumber: number | null }) => {
      invalidate(['trips', 'vehicles', 'drivers', 'payments'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === d.trip.id) st.setIncomingTrip(null)
    }

    const onTripCancelled = (d: { tripId: string }) => {
      invalidate(['trips', 'vehicles'])
      const st = useFleetStore.getState()
      if (st.incomingTrip?.id === d.tripId) st.setIncomingTrip(null)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('positions', onPositions)
    socket.on('vehicle:online', onVehicleOnline)
    socket.on('vehicle:offline', onVehicleOffline)
    socket.on('trip:new', onTripNew)
    socket.on('trip:assigned', onTripAssigned)
    socket.on('trip:ack', onTripAck)
    socket.on('trip:status', onTripStatus)
    socket.on('trip:completed', onTripCompleted)
    socket.on('trip:cancelled', onTripCancelled)

    // si el socket ya estaba conectado (HMR), forzar estado
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('positions', onPositions)
      socket.off('vehicle:online', onVehicleOnline)
      socket.off('vehicle:offline', onVehicleOffline)
      socket.off('trip:new', onTripNew)
      socket.off('trip:assigned', onTripAssigned)
      socket.off('trip:ack', onTripAck)
      socket.off('trip:status', onTripStatus)
      socket.off('trip:completed', onTripCompleted)
      socket.off('trip:cancelled', onTripCancelled)
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
