/**
 * Seed RUSHTAXI: 20 móviles con sus choferes + viajes de ejemplo.
 * Ejecutar con: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const driversData = [
  { name: 'Carlos Giménez', phone: '+54 9 11 4021-3387', license: 'D1-45218' },
  { name: 'Jorge Ferreyra', phone: '+54 9 11 5388-1290', license: 'D1-50112' },
  { name: 'Rubén Sosa', phone: '+54 9 11 6612-7745', license: 'D1-38904' },
  { name: 'Miguel Ángel Ríos', phone: '+54 9 11 3874-9021', license: 'D1-61233' },
  { name: 'Osvaldo Laguna', phone: '+54 9 11 2290-4156', license: 'D1-29875' },
  { name: 'Héctor Paz', phone: '+54 9 11 7745-3320', license: 'D1-44921' },
  { name: 'Daniel Barrientos', phone: '+54 9 11 5560-8812', license: 'D1-55310' },
  { name: 'Sergio Villalba', phone: '+54 9 11 6690-1245', license: 'D1-47855' },
  { name: 'Néstor Quiroga', phone: '+54 9 11 4412-7780', license: 'D1-36642' },
  { name: 'Walter Benítez', phone: '+54 9 11 8123-9034', license: 'D1-59127' },
  { name: 'Ariel Duarte', phone: '+54 9 11 3390-5612', license: 'D1-41290' },
  { name: 'Claudio Herrera', phone: '+54 9 11 9045-1187', license: 'D1-52743' },
  { name: 'Marcelo Aguirre', phone: '+54 9 11 2187-6690', license: 'D1-39817' },
  { name: 'Luis Contreras', phone: '+54 9 11 6023-4418', license: 'D1-46308' },
  { name: 'Fabio Coronel', phone: '+54 9 11 7780-9352', license: 'D1-58422' },
  { name: 'Esteban Maldonado', phone: '+54 9 11 9034-2267', license: 'D1-35501' },
  { name: 'Gabriel Ledesma', phone: '+54 9 11 4156-8890', license: 'D1-50983' },
  { name: 'Ramón Ojeda', phone: '+54 9 11 1290-7745', license: 'D1-44176' },
  { name: 'Aníbal Vera', phone: '+54 9 11 8812-3302', license: 'D1-61740' },
  { name: 'Julio Cáceres', phone: '+54 9 11 5560-1187', license: 'D1-43529' },
]

const vehiclesData = [
  { plate: 'AF128KD', model: 'Toyota Corolla', color: 'Negro' },
  { plate: 'AC734GH', model: 'Renault Logan', color: 'Blanco' },
  { plate: 'AE209LM', model: 'Nissan Versa', color: 'Gris plata' },
  { plate: 'AB951EF', model: 'Chevrolet Cruze', color: 'Negro' },
  { plate: 'AD460NP', model: 'Fiat Cronos', color: 'Blanco' },
  { plate: 'AF773BC', model: 'Toyota Etios', color: 'Blanco' },
  { plate: 'AC118QR', model: 'Renault Sandero', color: 'Gris plata' },
  { plate: 'AE542ST', model: 'Volkswagen Vento', color: 'Negro' },
  { plate: 'AB307VW', model: 'Ford Focus', color: 'Gris plata' },
  { plate: 'AD815XY', model: 'Chevrolet Onix', color: 'Blanco' },
  { plate: 'AF622JK', model: 'Toyota Corolla', color: 'Gris plata' },
  { plate: 'AC940MN', model: 'Renault Logan', color: 'Negro' },
  { plate: 'AE163PR', model: 'Nissan Sentra', color: 'Blanco' },
  { plate: 'AB587TU', model: 'Peugeot 301', color: 'Blanco' },
  { plate: 'AD342WX', model: 'Fiat Cronos', color: 'Gris plata' },
  { plate: 'AF701DE', model: 'Toyota Yaris', color: 'Negro' },
  { plate: 'AC255FG', model: 'Renault Kangoo', color: 'Blanco' },
  { plate: 'AE890HI', model: 'Volkswagen Gol', color: 'Gris plata' },
  { plate: 'AB473JK', model: 'Ford Fiesta', color: 'Negro' },
  { plate: 'AD608LM', model: 'Chevrolet Prisma', color: 'Blanco' },
]

function iso(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 3600 * 1000)
}

async function main() {
  console.log('Limpiando tablas...')
  await db.payment.deleteMany()
  await db.trip.deleteMany()
  await db.vehicle.deleteMany()
  await db.driver.deleteMany()

  console.log('Creando choferes y móviles...')
  for (let i = 0; i < 20; i++) {
    const driver = await db.driver.create({
      data: { ...driversData[i], active: true },
    })
    await db.vehicle.create({
      data: { number: i + 1, ...vehiclesData[i], driverId: driver.id },
    })
  }

  const vehicles = await db.vehicle.findMany({ include: { driver: true } })

  console.log('Creando viajes de ejemplo...')
  const completedSpecs = [
    { address: 'Av. Corrientes 1234, CABA', zone: 'Centro', fare: 4250, method: 'CASH', hoursAgo: 7.5, passenger: 'María López', phone: '+54 9 11 6612-3390' },
    { address: 'Av. Rivadavia 5210, Caballito', zone: 'Caballito', fare: 6100, method: 'CARD', hoursAgo: 6.2, passenger: 'Juan Domínguez', phone: '+54 9 11 3390-5512' },
    { address: 'Bulnes 890, Almagro', zone: 'Almagro', fare: 3800, method: 'CASH', hoursAgo: 5.1, passenger: 'Rosa Fernández', phone: '+54 9 11 8890-2267' },
    { address: 'Av. Santa Fe 3100, Recoleta', zone: 'Recoleta', fare: 5400, method: 'TRANSFER', hoursAgo: 4.0, passenger: 'Pedro Álvarez', phone: '+54 9 11 4418-9034' },
    { address: 'Av. de Mayo 650, Monserrat', zone: 'Monserrat', fare: 3200, method: 'CASH', hoursAgo: 2.8, passenger: 'Laura Peralta', phone: '+54 9 11 2267-8812' },
    { address: 'Av. Warnes 1200, Villa Crespo', zone: 'Villa Crespo', fare: 7300, method: 'CARD', hoursAgo: 1.6, passenger: 'Ernesto Molina', phone: '+54 9 11 9034-4418' },
    { address: 'Humboldt 1550, Palermo', zone: 'Palermo', fare: 8150, method: 'TRANSFER', hoursAgo: 0.9, passenger: 'Silvina Torres', phone: '+54 9 11 5512-3390' },
  ]

  for (let i = 0; i < completedSpecs.length; i++) {
    const spec = completedSpecs[i]
    const v = vehicles[i * 3 % 20]
    const createdAt = iso(spec.hoursAgo + 0.3)
    const completedAt = iso(spec.hoursAgo)
    const trip = await db.trip.create({
      data: {
        code: i + 1,
        address: spec.address,
        zone: spec.zone,
        passengerName: spec.passenger,
        passengerPhone: spec.phone,
        fare: spec.fare,
        status: 'COMPLETED',
        vehicleId: v.id,
        driverId: v.driverId,
        acknowledgedAt: new Date(createdAt.getTime() + 45 * 1000),
        startedAt: new Date(createdAt.getTime() + 6 * 60 * 1000),
        completedAt,
        paymentMethod: spec.method,
        createdAt,
      },
    })
    await db.payment.create({
      data: { tripId: trip.id, amount: spec.fare, method: spec.method, status: 'PAID', createdAt: completedAt },
    })
  }

  // Viaje cancelado ayer
  await db.trip.create({
    data: {
      code: 8,
      address: 'Olleros 2150, Belgrano',
      zone: 'Belgrano',
      passengerName: 'Ana Ruiz',
      passengerPhone: '+54 9 11 7745-6612',
      fare: 5600,
      status: 'CANCELLED',
      createdAt: iso(22),
    },
  })

  // Pedido pendiente cargado ahora
  await db.trip.create({
    data: {
      code: 9,
      address: 'Lavalle 780, San Nicolás',
      zone: 'Centro',
      passengerName: 'Marcos Acuña',
      passengerPhone: '+54 9 11 3302-5560',
      fare: 4100,
      status: 'PENDING',
      createdAt: iso(0.15),
    },
  })

  // Pedido programado para dentro de 40 minutos
  await db.trip.create({
    data: {
      code: 10,
      address: 'Av. Ángel Gallardo 500, Caballito',
      zone: 'Caballito',
      passengerName: 'Teresa Godoy',
      passengerPhone: '+54 9 11 1187-9045',
      fare: 5900,
      status: 'PENDING',
      scheduledAt: new Date(Date.now() + 40 * 60 * 1000),
      notes: 'Pasajera con valija. Tocar timbre depto 4.',
      createdAt: iso(0.4),
    },
  })

  const counts = {
    drivers: await db.driver.count(),
    vehicles: await db.vehicle.count(),
    trips: await db.trip.count(),
    payments: await db.payment.count(),
  }
  console.log('Seed RUSHTAXI completo:', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
