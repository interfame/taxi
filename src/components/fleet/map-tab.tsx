// Mapa en vivo de la flota con Leaflet puro (sin react-leaflet)
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type * as LeafletTypes from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useFleetStore } from '@/lib/store'
import type { VehicleDTO, VehiclePos } from '@/lib/types'

type LeafletModule = typeof import('leaflet')

interface FleetRow {
  vehicle: VehicleDTO
  pos: VehiclePos | null
}

type StatusKind = 'free' | 'busy' | 'offline' | 'nosignal'

const EMPTY_VEHICLES: VehicleDTO[] = []

const CENTER: [number, number] = [-34.6037, -58.3816]
const ZONE_RADIUS_M = 2200
const METERS_PER_DEGREE_LAT = 111_320

const MAP_STYLE_ID = 'rt-map-styles'

// Estilos globales para iconos/tooltip/popup de Leaflet (se inyectan una vez)
const MAP_STYLES = `
.rt-vehicle-icon { background: transparent; border: none; }
.rt-vehicle-pill {
  width: 36px; height: 36px; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; line-height: 1;
  border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35);
}
@keyframes rt-pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(245,158,11,.55); }
  70% { box-shadow: 0 0 0 14px rgba(245,158,11,0); }
  100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
}
.rt-pulse { animation: rt-pulse-ring 1.5s ease-out infinite; }
.rt-zone-label {
  background: #18181b; color: #fbbf24; border: 1px solid #f59e0b;
  border-radius: 8px; padding: 2px 10px;
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  box-shadow: 0 2px 6px rgba(0,0,0,.3);
}
.rt-zone-label::before { border-top-color: #f59e0b !important; }
.rt-zone-label::after { border-top-color: #18181b !important; }
.rt-vehicle-popup { font-size: 12px; line-height: 1.45; }
.rt-vehicle-popup strong { display: block; margin-bottom: 2px; font-size: 13px; }
`

const STATUS_LABEL: Record<StatusKind, string> = {
  free: 'Libre',
  busy: 'En carrera',
  offline: 'Desconectado',
  nosignal: 'Sin señal',
}

const STATUS_BADGE_CLASS: Record<StatusKind, string> = {
  free: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  busy: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400',
  offline: 'border-zinc-400/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  nosignal: 'border-zinc-300 bg-transparent text-zinc-500 dark:border-zinc-700',
}

const STATUS_DOT_CLASS: Record<StatusKind, string> = {
  free: 'bg-emerald-500',
  busy: 'bg-amber-500',
  offline: 'bg-zinc-500',
  nosignal: 'border-2 border-zinc-300 bg-transparent dark:border-zinc-600',
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function statusKind(pos: VehiclePos | null): StatusKind {
  if (!pos) return 'nosignal'
  if (!pos.online) return 'offline'
  return pos.busy ? 'busy' : 'free'
}

// Clave del estado visual que afecta al icono (para no recrear divIcons en cada tick)
function iconKey(pos: VehiclePos): string {
  if (!pos.online) return 'offline'
  if (!pos.busy) return 'free'
  return pos.phase === 'to_pickup' ? 'busy-pickup' : 'busy'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch)
}

function buildVehicleIcon(L: LeafletModule, number: number, pos: VehiclePos): LeafletTypes.DivIcon {
  const background = pos.online ? (pos.busy ? '#f59e0b' : '#10b981') : '#52525b'
  const color = pos.busy ? '#000000' : '#ffffff'
  const opacity = pos.online ? '1' : '0.55'
  const pulse = pos.online && pos.busy && pos.phase === 'to_pickup' ? ' rt-pulse' : ''
  return L.divIcon({
    className: 'rt-vehicle-icon',
    html: `<div class="rt-vehicle-pill${pulse}" style="background:${background};color:${color};opacity:${opacity}">${number}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  })
}

function popupHtml(row: FleetRow, pos: VehiclePos): string {
  const { vehicle } = row
  const lines = [
    `<strong>Móvil ${vehicle.number}</strong>`,
    escapeHtml(vehicle.driver?.name ?? 'Sin chofer'),
    `Patente: ${escapeHtml(vehicle.plate)}`,
    `Estado: ${STATUS_LABEL[statusKind(pos)]}`,
  ]
  const trip = vehicle.currentTrip
  if (trip) lines.push(`Viaje: ${escapeHtml(trip.address)}`)
  return lines.map((line) => `<div>${line}</div>`).join('')
}

function injectMapStyles(): void {
  if (document.getElementById(MAP_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = MAP_STYLE_ID
  style.textContent = MAP_STYLES
  document.head.appendChild(style)
}

function buildRows(vehicles: VehicleDTO[], positions: Record<number, VehiclePos>): FleetRow[] {
  return [...vehicles]
    .sort((a, b) => a.number - b.number)
    .map((vehicle) => ({ vehicle, pos: positions[vehicle.number] ?? null }))
}

export function MapTab() {
  const positions = useFleetStore((s) => s.positions)

  const { data } = useQuery<{ vehicles: VehicleDTO[] }>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await fetch('/api/vehicles')
      if (!res.ok) throw new Error('Error al cargar los móviles')
      return (await res.json()) as { vehicles: VehicleDTO[] }
    },
  })

  const [mapReady, setMapReady] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletTypes.Map | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const markersRef = useRef<Map<number, LeafletTypes.Marker>>(new Map())
  const iconStateRef = useRef<Map<number, string>>(new Map())
  const popupStateRef = useRef<Map<number, string>>(new Map())

  const vehicles = data?.vehicles ?? EMPTY_VEHICLES
  const rows = useMemo<FleetRow[]>(() => buildRows(vehicles, positions), [vehicles, positions])
  const onlineCount = rows.filter((row) => row.pos?.online).length

  // Inicialización del mapa (solo cliente, con import dinámico para evitar SSR de leaflet)
  useEffect(() => {
    let disposed = false
    let instance: LeafletTypes.Map | null = null
    let invalidateTimer: number | undefined

    const init = async () => {
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      injectMapStyles()

      const map = L.map(containerRef.current, {
        center: CENTER,
        zoom: 14,
        scrollWheelZoom: true,
      })
      instance = map
      mapRef.current = map
      leafletRef.current = L

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      L.circle(CENTER, {
        radius: ZONE_RADIUS_M,
        color: '#f59e0b',
        weight: 2,
        dashArray: '6 6',
        fillColor: '#f59e0b',
        fillOpacity: 0.05,
      }).addTo(map)

      // Rótulo permanente sobre el borde superior de la zona (fijo en coordenadas)
      L.tooltip({ permanent: true, direction: 'top', className: 'rt-zone-label' })
        .setLatLng([CENTER[0] + ZONE_RADIUS_M / METERS_PER_DEGREE_LAT, CENTER[1]])
        .setContent('ZONA CENTRO')
        .addTo(map)

      // Por si el contenedor cambió de tamaño durante el montaje
      invalidateTimer = window.setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 250)

      setMapReady(true)
    }

    void init()

    return () => {
      disposed = true
      if (invalidateTimer !== undefined) window.clearTimeout(invalidateTimer)
      instance?.remove()
      instance = null
      mapRef.current = null
      leafletRef.current = null
      markersRef.current.clear()
      iconStateRef.current.clear()
      popupStateRef.current.clear()
    }
  }, [])

  // Sincronización de markers con las posiciones del store (tick cada 2s)
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!mapReady || !L || !map) return

    const withPos = new Set<number>()

    for (const row of rows) {
      const pos = row.pos
      if (!pos) continue
      const number = row.vehicle.number
      withPos.add(number)

      const existing = markersRef.current.get(number)
      if (existing) {
        existing.setLatLng([pos.lat, pos.lng])

        const nextKey = iconKey(pos)
        if (iconStateRef.current.get(number) !== nextKey) {
          existing.setIcon(buildVehicleIcon(L, number, pos))
          iconStateRef.current.set(number, nextKey)
        }

        const html = popupHtml(row, pos)
        if (popupStateRef.current.get(number) !== html) {
          existing.setPopupContent(html)
          popupStateRef.current.set(number, html)
        }
        continue
      }

      const html = popupHtml(row, pos)
      const marker = L.marker([pos.lat, pos.lng], { icon: buildVehicleIcon(L, number, pos) })
      marker.bindPopup(html, { className: 'rt-vehicle-popup' })
      marker.on('click', () => {
        setSelectedVehicle(number)
        mapRef.current?.panTo(marker.getLatLng())
      })
      marker.addTo(map)
      markersRef.current.set(number, marker)
      iconStateRef.current.set(number, iconKey(pos))
      popupStateRef.current.set(number, html)
    }

    // Eliminar markers cuyos móviles dejaron de tener posición
    for (const [number, marker] of markersRef.current) {
      if (!withPos.has(number)) {
        map.removeLayer(marker)
        markersRef.current.delete(number)
        iconStateRef.current.delete(number)
        popupStateRef.current.delete(number)
      }
    }
  }, [rows, mapReady])

  const focusVehicle = (row: FleetRow) => {
    setSelectedVehicle(row.vehicle.number)
    if (!row.pos) return
    mapRef.current?.panTo([row.pos.lat, row.pos.lng])
    markersRef.current.get(row.vehicle.number)?.openPopup()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {/* Columna izquierda: mapa */}
      <div
        className="relative z-0 isolate h-[calc(100vh-240px)] min-h-[440px] overflow-hidden rounded-xl border bg-zinc-100 dark:bg-zinc-900"
        role="application"
        aria-label="Mapa en vivo de la flota de taxis"
      >
        <div ref={containerRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 z-[500] grid place-items-center">
            <p className="text-sm text-muted-foreground">Cargando mapa…</p>
          </div>
        )}
      </div>

      {/* Columna derecha: panel de flota */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Flota en el mapa</CardTitle>
          <CardDescription>Seguimiento GPS en tiempo real</CardDescription>
          <CardAction>
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            >
              {onlineCount}/20 conectados
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul
            className="flex max-h-[560px] flex-col gap-1 overflow-y-auto pr-1"
            aria-label="Lista de móviles de la flota"
          >
            {rows.map((row) => {
              const kind = statusKind(row.pos)
              const number = row.vehicle.number
              const selected = selectedVehicle === number
              return (
                <li key={row.vehicle.id}>
                  <button
                    type="button"
                    onClick={() => focusVehicle(row)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
                      selected && 'bg-amber-500/10 ring-2 ring-amber-400',
                    )}
                    aria-label={`Centrar mapa en el móvil ${number}`}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn('size-3 shrink-0 rounded-full', STATUS_DOT_CLASS[kind])}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Móvil {number}</span>
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[kind]}>
                          {STATUS_LABEL[kind]}
                        </Badge>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.vehicle.driver?.name ?? 'Sin chofer'}
                      </span>
                      {kind === 'busy' && row.vehicle.currentTrip && (
                        <span className="block truncate text-xs text-amber-700 dark:text-amber-500">
                          {row.vehicle.currentTrip.address}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
            {rows.length === 0 && (
              <li className="px-2 py-4 text-sm text-muted-foreground">Cargando móviles…</li>
            )}
          </ul>

          {/* Leyenda */}
          <div className="border-t pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {(['free', 'busy', 'offline', 'nosignal'] as const).map((kind) => (
                <span
                  key={kind}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={cn('size-3 rounded-full', STATUS_DOT_CLASS[kind])}
                    aria-hidden="true"
                  />
                  {STATUS_LABEL[kind]}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              GPS en vivo. En esta demo las posiciones se simulan dentro de la zona.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
