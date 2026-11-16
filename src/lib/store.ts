// Store global de la flota (zustand) - estado en tiempo real vía socket
'use client'

import { create } from 'zustand'
import type { TripDTO, VehiclePos } from '@/lib/types'

export interface SelectedDriverInfo {
  id: string
  name: string
  vehicleNumber: number
}

const LS_DRIVER = 'rushtaxi.selectedDriver'
const LS_ONLINE = 'rushtaxi.driverOnline'
const LS_MUTED = 'rushtaxi.muted'

function loadJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveJSON(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage no disponible
  }
}

interface FleetStore {
  socketConnected: boolean
  positions: Record<number, VehiclePos>
  positionsTs: number
  selectedDriver: SelectedDriverInfo | null
  driverOnline: boolean
  incomingTrip: TripDTO | null
  muted: boolean

  hydrate: () => void
  setSocketConnected: (v: boolean) => void
  setPositions: (vehicles: VehiclePos[], ts: number) => void
  patchPosition: (pos: Partial<VehiclePos> & { number: number }) => void
  setSelectedDriver: (d: SelectedDriverInfo | null) => void
  setDriverOnline: (online: boolean) => void
  setIncomingTrip: (t: TripDTO | null) => void
  toggleMuted: () => void
}

export const useFleetStore = create<FleetStore>((set, get) => ({
  socketConnected: false,
  positions: {},
  positionsTs: 0,
  selectedDriver: null,
  driverOnline: false,
  incomingTrip: null,
  muted: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    const driver = loadJSON<SelectedDriverInfo>(LS_DRIVER)
    const online = window.localStorage.getItem(LS_ONLINE) === '1'
    const muted = window.localStorage.getItem(LS_MUTED) === '1'
    set({ selectedDriver: driver, driverOnline: driver ? online : false, muted })
  },

  setSocketConnected: (v) => set({ socketConnected: v }),

  setPositions: (vehicles, ts) => {
    const next: Record<number, VehiclePos> = {}
    for (const p of vehicles) next[p.number] = p
    set({ positions: next, positionsTs: ts })
  },

  patchPosition: (pos) => {
    const cur = get().positions
    const existing = cur[pos.number]
    set({
      positions: {
        ...cur,
        [pos.number]: {
          number: pos.number,
          lat: pos.lat ?? existing?.lat ?? 0,
          lng: pos.lng ?? existing?.lng ?? 0,
          heading: pos.heading ?? existing?.heading ?? 0,
          online: pos.online ?? existing?.online ?? false,
          phase: pos.phase ?? existing?.phase ?? 'idle',
          busy: pos.busy ?? existing?.busy ?? false,
        },
      },
    })
  },

  setSelectedDriver: (d) => {
    saveJSON(LS_DRIVER, d)
    if (!d) {
      window.localStorage.removeItem(LS_ONLINE)
      set({ selectedDriver: null, driverOnline: false })
    } else {
      set({ selectedDriver: d })
    }
  },

  setDriverOnline: (online) => {
    window.localStorage.setItem(LS_ONLINE, online ? '1' : '0')
    set({ driverOnline: online })
  },

  setIncomingTrip: (t) => set({ incomingTrip: t }),

  toggleMuted: () => {
    const next = !get().muted
    window.localStorage.setItem(LS_MUTED, next ? '1' : '0')
    set({ muted: next })
  },
}))
