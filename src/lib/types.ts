// Tipos compartidos entre el backend y el frontend de RUSHTAXI

export type TripStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'
export type VehiclePhase = 'idle' | 'to_pickup' | 'wait' | 'to_dest'

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

export interface DriverDTO {
  id: string
  name: string
  phone: string
  license: string
  active: boolean
  createdAt: string
}

export interface CurrentTripDTO {
  id: string
  code: number
  address: string
  status: TripStatus
  passengerName: string
}

export interface VehicleDTO {
  id: string
  number: number
  plate: string
  model: string
  color: string
  driver: DriverDTO | null
  currentTrip: CurrentTripDTO | null
}

export interface TripDTO {
  id: string
  code: number
  address: string
  zone: string | null
  passengerName: string
  passengerPhone: string | null
  fare: number
  notes: string | null
  scheduledAt: string | null
  status: TripStatus
  vehicleId: string | null
  vehicleNumber: number | null
  driverId: string | null
  driverName: string | null
  acknowledgedAt: string | null
  startedAt: string | null
  completedAt: string | null
  paymentMethod: PaymentMethod | null
  createdAt: string
}

export interface PaymentDTO {
  id: string
  tripId: string
  amount: number
  method: PaymentMethod
  status: string
  createdAt: string
  tripCode: number | null
  tripAddress: string | null
  vehicleNumber: number | null
  driverName: string | null
}

export interface PaymentSummary {
  todayTotal: number
  todayCount: number
  byMethod: { method: PaymentMethod; total: number; count: number }[]
  last7Days: { date: string; label: string; total: number; count: number }[]
}

export interface PaymentsResponse {
  summary: PaymentSummary
  payments: PaymentDTO[]
}

export interface DriverWithStatsDTO extends DriverDTO {
  vehicleNumber: number | null
  vehiclePlate: string | null
  vehicleModel: string | null
  completedTrips: number
  earned: number
}

export interface VehiclePos {
  number: number
  lat: number
  lng: number
  heading: number
  online: boolean
  phase: VehiclePhase
  busy: boolean
}

export interface FleetStateResponse {
  ts: number
  vehicles: VehiclePos[]
}

// Contrato de eventos de la flota (socket.io)
export interface FleetEvents {
  positions: { ts: number; vehicles: VehiclePos[] }
  'vehicle:online': { vehicleNumber: number; driverName: string | null; ts: number }
  'vehicle:offline': { vehicleNumber: number; ts: number }
  'trip:new': { trip: TripDTO }
  'trip:assigned': { trip: TripDTO; vehicleNumber: number; pickup?: { lat: number; lng: number }; dest?: { lat: number; lng: number } }
  'trip:ack': { tripId: string; vehicleNumber: number; ts: number }
  'trip:status': { tripId: string; status: TripStatus; vehicleNumber: number | null }
  'trip:completed': { trip: TripDTO; payment: { id: string; amount: number; method: PaymentMethod }; vehicleNumber: number | null }
  'trip:cancelled': { tripId: string; vehicleNumber: number | null }
}
