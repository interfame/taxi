// Pantalla de inicio de sesión de RUSHTAXI
'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CarTaxiFront,
  Eye,
  EyeOff,
  Info,
  Loader2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LS_LAST_EMAIL = 'rushtaxi.lastEmail'

interface LoginViewProps {
  onSuccess: (user: { id: string; email: string; name: string; role: string }) => void
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const last = window.localStorage.getItem(LS_LAST_EMAIL)
      if (last) setEmail(last)
    } catch {
      // storage no disponible
    }
    emailRef.current?.focus()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json().catch(() => null)) as {
        user?: { id: string; email: string; name: string; role: string }
        error?: string
      } | null

      if (!res.ok || !data?.user) {
        setError(data?.error ?? 'No se pudo iniciar sesión.')
        return
      }

      try {
        window.localStorage.setItem(LS_LAST_EMAIL, data.user.email)
      } catch {
        // storage no disponible
      }

      onSuccess(data.user)
      router.refresh()
    } catch {
      setError('Error de conexión. Verificá tu red y probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo() {
    setEmail('gonzalo@demo.com')
    setPassword('gonzalo123')
    setError(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Marca */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 shadow-lg shadow-amber-400/20">
              <CarTaxiFront className="h-10 w-10 text-zinc-950" aria-hidden />
            </div>
            <h1 className="mt-4 text-4xl font-black italic tracking-tighter text-zinc-50">
              RUSH<span className="text-amber-400">TAXI</span>
            </h1>
            <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Sistema de despacho de flota
            </p>
          </div>

          {/* Card de login */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl sm:p-8">
            <h2 className="text-lg font-bold text-zinc-100">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Entrá con tu usuario para acceder al panel de despacho.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-zinc-300">
                  Usuario
                </Label>
                <Input
                  id="login-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="nombre@demo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-11 border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-zinc-300">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-11 border-zinc-700 bg-zinc-950 pr-11 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="h-11 w-full cursor-pointer bg-amber-400 text-base font-bold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Ingresando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" aria-hidden />
                    Ingresar
                  </>
                )}
              </Button>
            </form>

            {/* Acceso rápido con la cuenta demo */}
            <button
              type="button"
              onClick={fillDemo}
              className="mt-5 w-full rounded-lg border border-dashed border-zinc-700 bg-zinc-950/60 px-3 py-3 text-left transition-colors hover:border-amber-500/50 hover:bg-zinc-900"
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Cuenta de prueba
              </span>
              <span className="mt-1.5 block font-mono text-sm text-zinc-300">
                gonzalo@demo.com <span className="text-zinc-600">/</span> gonzalo123
              </span>
            </button>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-600">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Sesión protegida con cookie segura - válida por 30 días
          </p>
        </div>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-3 text-center text-xs text-zinc-500">
          <span className="font-semibold text-zinc-400">RUSHTAXI</span> - Despacho, GPS en vivo, choferes, historial y pagos
        </div>
      </footer>
    </div>
  )
}
