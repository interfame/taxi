// POST /api/auth/login - inicia sesión con email + contraseña
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Ingresá el usuario y la contraseña.' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      )
    }

    await createSession(user.id)

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (err) {
    console.error('[auth/login] error:', err)
    return NextResponse.json(
      { error: 'Error interno al iniciar sesión. Probá de nuevo.' },
      { status: 500 }
    )
  }
}
