// RUSHTAXI - Plataforma de gestión de flota (todo en / con vistas por tabs)
'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CarTaxiFront,
  ClipboardList,
  History,
  MapPinned,
  RadioTower,
  UserRound,
  Volume2,
  VolumeX,
  Wallet,
  CarFront,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { nowClock } from '@/lib/format'
import { useFleetStore } from '@/lib/store'
import { FleetProvider } from '@/components/fleet/fleet-provider'
import { AlarmOverlay } from '@/components/fleet/alarm-overlay'
import { OperatorTab } from '@/components/fleet/operator-tab'
import { MapTab } from '@/components/fleet/map-tab'
import { DriverTab } from '@/components/fleet/driver-tab'
import { HistoryTab } from '@/components/fleet/history-tab'
import { PaymentsTab } from '@/components/fleet/payments-tab'
import { FleetTab } from '@/components/fleet/fleet-tab'
import type { TripDTO } from '@/lib/types'

type TabId = 'operator' | 'map' | 'driver' | 'history' | 'payments' | 'fleet'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'operator', label: 'Operador', icon: ClipboardList },
  { id: 'map', label: 'Mapa en vivo', icon: MapPinned },
  { id: 'driver', label: 'Panel del chófer', icon: UserRound },
  { id: 'history', label: 'Viajes', icon: History },
  { id: 'payments', label: 'Pagos', icon: Wallet },
  { id: 'fleet', label: 'Choferes', icon: CarFront },
]

function Clock() {
  const [clock, setClock] = useState('')
  useEffect(() => {
    const show = setTimeout(() => setClock(nowClock()), 0)
    const t = setInterval(() => setClock(nowClock()), 1000)
    return () => {
      clearTimeout(show)
      clearInterval(t)
    }
  }, [])
  return (
    <span className="hidden font-mono text-sm tabular-nums text-zinc-400 md:inline" aria-label="Hora actual">
      {clock || '--:--:--'}
    </span>
  )
}

function LiveFooter() {
  const positions = useFleetStore((s) => s.positions)
  const socketConnected = useFleetStore((s) => s.socketConnected)

  const { data } = useQuery<{ trips: TripDTO[] }>({
    queryKey: ['trips', 'footer-pending'],
    queryFn: async () => {
      const res = await fetch('/api/trips?status=PENDING&limit=500')
      if (!res.ok) throw new Error('Error al consultar pendientes')
      return res.json()
    },
    refetchInterval: 20000,
  })

  const online = Object.values(positions).filter((p) => p.online).length
  const pending = data?.trips.length ?? 0

  return (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-950 text-xs text-zinc-400">
      <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="font-semibold text-zinc-300">
          RUSHTAXI <span className="font-normal text-zinc-500">- Sistema de gestión de flota con despacho, GPS y pagos</span>
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5" aria-label="Móviles conectados">
            <RadioTower className={cn('h-3.5 w-3.5', online > 0 ? 'text-emerald-400' : 'text-zinc-600')} aria-hidden />
            Móviles conectados: <strong className="text-zinc-200">{online}</strong>/20
          </span>
          <span aria-label="Pedidos pendientes">
            Pendientes: <strong className={pending > 0 ? 'text-amber-400' : 'text-zinc-200'}>{pending}</strong>
          </span>
          <span className="flex items-center gap-1.5" aria-label="Estado de la conexión en tiempo real">
            {socketConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> En vivo
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-red-400" aria-hidden /> Sin conexión
              </>
            )}
          </span>
        </div>
      </div>
    </footer>
  )
}

function Shell() {
  const [activeTab, setActiveTab] = useState<TabId>('operator')
  const muted = useFleetStore((s) => s.muted)
  const toggleMuted = useFleetStore((s) => s.toggleMuted)
  const socketConnected = useFleetStore((s) => s.socketConnected)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto w-full max-w-[1500px] px-4">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-zinc-950">
                <CarTaxiFront className="h-6 w-6" aria-hidden />
              </div>
              <div className="leading-none">
                <p className="text-lg font-black italic tracking-tighter text-zinc-50">
                  RUSH<span className="text-amber-400">TAXI</span>
                </p>
                <p className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-widest text-zinc-500 sm:block">
                  Despacho de flota - Zona Centro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <Clock />
              <button
                onClick={toggleMuted}
                aria-label={muted ? 'Activar sonidos' : 'Silenciar sonidos'}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                  muted
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                    : 'border-amber-500/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                )}
              >
                {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                <span className="hidden sm:inline">{muted ? 'Silenciado' : 'Sonidos'}</span>
              </button>
              <span
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold',
                  socketConnected
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/40 bg-red-500/10 text-red-400'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    socketConnected ? 'animate-pulse bg-emerald-400' : 'bg-red-400'
                  )}
                  aria-hidden
                />
                {socketConnected ? 'En vivo' : 'Conectando'}
              </span>
            </div>
          </div>

          <nav aria-label="Secciones del sistema" className="flex gap-1 overflow-x-auto pb-1.5">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors md:px-4',
                    isActive
                      ? 'bg-amber-400 text-zinc-950'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-4 md:px-6 md:py-6">
        {activeTab === 'operator' && <OperatorTab />}
        {activeTab === 'map' && <MapTab />}
        {activeTab === 'driver' && <DriverTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'fleet' && <FleetTab />}
      </main>

      <LiveFooter />
      <AlarmOverlay />
    </div>
  )
}

export default function Home() {
  return (
    <FleetProvider>
      <Shell />
    </FleetProvider>
  )
}
