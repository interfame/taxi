// Overlay de alarma a pantalla completa cuando llega un pedido al móvil del chófer
'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, MapPin, Phone, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useFleetStore } from '@/lib/store'
import { fleetAlarm } from '@/lib/alarm'
import { formatARS } from '@/lib/format'
import { TRIP_STATUS_LABEL } from '@/lib/types'

export function AlarmOverlay() {
  const incomingTrip = useFleetStore((s) => s.incomingTrip)
  const setIncomingTrip = useFleetStore((s) => s.setIncomingTrip)
  const selectedDriver = useFleetStore((s) => s.selectedDriver)

  // alarma sonora en loop mientras haya pedido entrante
  useEffect(() => {
    if (incomingTrip) {
      fleetAlarm.startAlarm()
    } else {
      fleetAlarm.stopAlarm()
    }
    return () => fleetAlarm.stopAlarm()
  }, [incomingTrip])

  const handleAck = async () => {
    if (!incomingTrip) return
    fleetAlarm.stopAlarm()
    setIncomingTrip(null)
    try {
      await fetch(`/api/trips/${incomingTrip.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ack' }),
      })
      toast.success('Pedido atendido', {
        description: 'Ya estás en camino al pasajero. La operadora fue avisada.',
      })
    } catch {
      toast.error('No se pudo confirmar el pedido. Probá de nuevo.')
    }
  }

  return (
    <AnimatePresence>
      {incomingTrip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Nuevo pedido asignado"
        >
          <motion.div
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border-4 border-amber-400 bg-zinc-900 shadow-2xl shadow-amber-500/30"
          >
            <div className="flex items-center gap-3 bg-amber-400 px-5 py-4 text-zinc-950">
              <BellRing className="h-8 w-8 animate-bounce" aria-hidden />
              <div>
                <p className="text-xl font-black uppercase leading-none tracking-tight">
                  Nuevo pedido asignado
                </p>
                <p className="mt-1 text-sm font-semibold opacity-80">
                  Móvil #{selectedDriver?.vehicleNumber ?? incomingTrip.vehicleNumber} -{' '}
                  {selectedDriver?.name ?? incomingTrip.driverName}
                </p>
              </div>
            </div>

            <div className="space-y-5 px-5 py-6 text-zinc-100">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Dirección a cubrir
                </p>
                <p className="mt-1 text-3xl font-extrabold leading-tight">{incomingTrip.address}</p>
                {incomingTrip.zone && (
                  <Badge className="mt-2 bg-zinc-800 text-zinc-200 border border-zinc-700">
                    Zona: {incomingTrip.zone}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-zinc-300">
                <span className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-amber-400" aria-hidden />
                  {incomingTrip.passengerName}
                </span>
                {incomingTrip.passengerPhone && (
                  <a
                    href={`tel:${incomingTrip.passengerPhone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-base underline decoration-zinc-600 underline-offset-4 hover:text-amber-400"
                  >
                    <Phone className="h-4 w-4 text-amber-400" aria-hidden />
                    {incomingTrip.passengerPhone}
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-zinc-400">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Pedido #{incomingTrip.code} - {TRIP_STATUS_LABEL[incomingTrip.status]}
                </span>
                {incomingTrip.fare > 0 && (
                  <span className="text-lg font-bold text-amber-400">
                    {formatARS(incomingTrip.fare)}
                  </span>
                )}
              </div>

              {incomingTrip.notes && (
                <p className="rounded-lg bg-zinc-800/60 px-4 py-2 text-sm text-zinc-300">
                  Nota: {incomingTrip.notes}
                </p>
              )}

              <Button
                size="lg"
                onClick={handleAck}
                className="h-16 w-full bg-emerald-500 text-xl font-black text-zinc-950 hover:bg-emerald-400"
              >
                ATENDIDO - YA VOY EN CAMINO
              </Button>
              <p className="text-center text-xs text-zinc-500">
                El sonido se detiene al tocar ATENDIDO
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
