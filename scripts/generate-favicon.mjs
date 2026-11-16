/**
 * Genera los favicons de RUSHTAXI a partir de src/app/icon.svg:
 *  - src/app/favicon.ico    (16/32/48 px)
 *  - src/app/icon.png       (192 px)
 *  - src/app/apple-icon.png (180 px)
 *  - public/logo.svg        (logo maestro)
 * Uso: bun scripts/generate-favicon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const appDir = path.join(root, 'src', 'app')
const svgPath = path.join(appDir, 'icon.svg')
const svg = readFileSync(svgPath)

async function renderPng(size) {
  return sharp(svg, { density: 600 })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer()
}

// Contenedor ICO con imágenes PNG embebidas (soportado por todos los navegadores)
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reservado
  header.writeUInt16LE(1, 2) // tipo: icono
  header.writeUInt16LE(images.length, 4)

  const entries = []
  const blobs = []
  let offset = 6 + images.length * 16

  for (const img of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0) // ancho
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1) // alto
    entry.writeUInt8(0, 2) // colores en paleta
    entry.writeUInt8(0, 3) // reservado
    entry.writeUInt16LE(1, 4) // planos
    entry.writeUInt16LE(32, 6) // bits por pixel
    entry.writeUInt32LE(img.data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += img.data.length
    entries.push(entry)
    blobs.push(img.data)
  }

  return Buffer.concat([header, ...entries, ...blobs])
}

const [p16, p32, p48, p180, p192] = await Promise.all([
  renderPng(16),
  renderPng(32),
  renderPng(48),
  renderPng(180),
  renderPng(192),
])

writeFileSync(
  path.join(appDir, 'favicon.ico'),
  buildIco([
    { size: 16, data: p16 },
    { size: 32, data: p32 },
    { size: 48, data: p48 },
  ])
)
writeFileSync(path.join(appDir, 'icon.png'), p192)
writeFileSync(path.join(appDir, 'apple-icon.png'), p180)
writeFileSync(path.join(root, 'public', 'logo.svg'), svg)

console.log('Favicons generados: favicon.ico, icon.png, apple-icon.png, public/logo.svg')
