import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// Entornos serverless (Vercel): el filesystem es efímero y solo /tmp es
// escribible. Si DATABASE_URL no apunta a un archivo existente, se copia la
// base SQLite incluida en el bundle (db/custom.db) a /tmp para que la demo
// arranque con datos de ejemplo y se puedan escribir sesiones y pedidos.
function ensureServerlessDatabase(): void {
  let url = process.env.DATABASE_URL
  if (!url) {
    process.env.DATABASE_URL = 'file:/tmp/rushtaxi-demo.db'
    url = process.env.DATABASE_URL
  }

  if (!url.startsWith('file:')) return
  const dbPath = url.slice('file:'.length)
  if (!dbPath.startsWith('/tmp') || fs.existsSync(dbPath)) return

  const candidates = [
    path.join(process.cwd(), 'db', 'custom.db'),
    path.join(process.cwd(), '..', 'db', 'custom.db'),
    path.join(process.cwd(), '..', '..', 'db', 'custom.db'),
  ]
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        fs.copyFileSync(candidate, dbPath)
        console.log(`[db] demo SQLite copiada a ${dbPath}`)
        break
      }
    } catch {
      // siguiente candidato
    }
  }
}

ensureServerlessDatabase()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
