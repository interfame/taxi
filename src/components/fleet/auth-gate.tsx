// Gate de autenticación: protege toda la app tras el login
'use client'

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { CarTaxiFront } from 'lucide-react'
import { LoginView } from '@/components/fleet/login-view'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!res.ok) return null // 401: no autenticado
    const data = (await res.json()) as { user?: AuthUser }
    return data.user ?? null
  } catch {
    return null
  }
}

/** Hook para leer el usuario logueado desde el cache de react-query. */
export function useAuthUser(): UseQueryResult<AuthUser | null, Error> {
  return useQuery<AuthUser | null>({ queryKey: ['me'], queryFn: fetchMe, staleTime: 60_000 })
}

function LoginSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-amber-400">
        <CarTaxiFront className="h-8 w-8 text-zinc-950" aria-hidden />
      </div>
      <p className="mt-4 text-2xl font-black italic tracking-tighter">
        RUSH<span className="text-amber-400">TAXI</span>
      </p>
      <p className="mt-2 text-sm text-zinc-500">Cargando panel de despacho...</p>
    </div>
  )
}

export function AuthGate({ children }: { children: (user: AuthUser) => React.ReactNode }) {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useAuthUser()

  if (isLoading) return <LoginSplash />

  if (!user) {
    return (
      <LoginView
        onSuccess={(u) => {
          queryClient.setQueryData(['me'], u)
          // refrescar datos operativos al entrar
          void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
          void queryClient.invalidateQueries({ queryKey: ['trips'] })
        }}
      />
    )
  }

  return <>{children(user)}</>
}
