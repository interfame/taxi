// Autenticación de RUSHTAXI: hash de contraseñas + sesiones con cookie httpOnly
// SOLO servidor (route handlers). No importar desde componentes cliente.
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'rushtaxi_session'
const SESSION_DAYS = 30

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

/** Genera "salt:hash" con scrypt para guardar en la DB. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** Verifica una contraseña contra el hash guardado (comparación en tiempo constante). */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    if (candidate.length !== expected.length) return false
    return timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

/** Crea una sesión en la DB y deja la cookie httpOnly en la respuesta. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // el preview puede servir por http; la cookie viaja igual
    path: '/',
    expires: expiresAt,
  })
}

/** Devuelve el usuario logueado según la cookie, o null si no hay sesión válida. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })
    if (!session) return null

    if (session.expiresAt.getTime() < Date.now()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
      return null
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    }
  } catch (err) {
    console.error('[auth] error al leer sesión:', err)
    return null
  }
}

/** Cierra la sesión actual (borra registro + cookie). */
export async function destroySession(): Promise<void> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (token) {
      await db.session.deleteMany({ where: { token } })
    }
    store.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 0,
    })
  } catch (err) {
    console.error('[auth] error al cerrar sesión:', err)
  }
}
