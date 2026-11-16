/**
 * Post-build:
 * - En Vercel no hay nada que hacer (Vercel empaqueta por su cuenta).
 * - En los demás entornos (standalone) copia static y public al server bundle.
 */
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV === '1') {
  console.log('[postbuild] Vercel detectado: se omite el empaquetado standalone')
  process.exit(0)
}

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')
if (!existsSync(standalone)) {
  console.log('[postbuild] no hay output standalone; nada que copiar')
  process.exit(0)
}

cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true })
cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true })
console.log('[postbuild] standalone listo')
