import type { Driver, Payment, Trip, Vehicle } from '@prisma/client'
import type { PaymentDTO, PaymentMethod, TripDTO, TripStatus, VehicleDTO } from '@/lib/types'

type TripRelations = {
  vehicle?: Vehicle | null
  driver?: Driver | null
  payment?: Payment | null
}

type TripWithRelations = Trip & TripRelations

export function serializeTrip(t: TripWithRelations): TripDTO {
  return {
    id: t.id,
    code: t.code,
    address: t.address,
    zone: t.zone,
    passengerName: t.passengerName,
    passengerPhone: t.passengerPhone,
    fare: t.fare,
    notes: t.notes,
    scheduledAt: t.scheduledAt ? t.scheduledAt.toISOString() : null,
    status: t.status as TripStatus,
    vehicleId: t.vehicleId,
    vehicleNumber: t.vehicle ? t.vehicle.number : null,
    driverId: t.driverId,
    driverName: t.driver ? t.driver.name : null,
    acknowledgedAt: t.acknowledgedAt ? t.acknowledgedAt.toISOString() : null,
    startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    paymentMethod: (t.paymentMethod as PaymentMethod) ?? null,
    createdAt: t.createdAt.toISOString(),
  }
}

type VehicleWithDriver = Vehicle & { driver: Driver | null }

export function serializeVehicle(v: VehicleWithDriver, currentTrip: TripWithRelations | null): VehicleDTO {
  return {
    id: v.id,
    number: v.number,
    plate: v.plate,
    model: v.model,
    color: v.color,
    driver: v.driver
      ? {
          id: v.driver.id,
          name: v.driver.name,
          phone: v.driver.phone,
          license: v.driver.license,
          active: v.driver.active,
          createdAt: v.driver.createdAt.toISOString(),
        }
      : null,
    currentTrip: currentTrip
      ? {
          id: currentTrip.id,
          code: currentTrip.code,
          address: currentTrip.address,
          status: currentTrip.status as TripStatus,
          passengerName: currentTrip.passengerName,
        }
      : null,
  }
}
