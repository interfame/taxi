// Alarmas y pitidos con Web Audio API (sin archivos de audio)
// - fleetAlarm.startAlarm(): timbre en loop para el chófer cuando le asignan un pedido
// - fleetAlarm.beepOnce(): pitido suave para la operadora ante eventos nuevos

type AudioContextCtor = typeof AudioContext

class FleetAlarm {
  private ctx: AudioContext | null = null
  private loopTimer: ReturnType<typeof setInterval> | null = null
  private ringing = false

  /** Debe llamarse desde un gesto del usuario para desbloquear el audio. */
  unlock(): void {
    try {
      if (typeof window === 'undefined') return
      if (!this.ctx) {
        const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
        const Ctor = w.AudioContext ?? w.webkitAudioContext
        if (!Ctor) return
        this.ctx = new Ctor()
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }
    } catch {
      // audio no disponible: la alarma visual sigue funcionando
    }
  }

  private tone(freq: number, offset: number, dur: number, gain: number, type: OscillatorType): void {
    if (!this.ctx) return
    const t0 = this.ctx.currentTime + offset
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015)
    g.gain.setValueAtTime(gain, t0 + Math.max(0.02, dur - 0.03))
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  /** Pitido corto doble, para la operadora (nuevo pedido / pedido programado). */
  beepOnce(): void {
    this.unlock()
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.tone(880, 0, 0.12, 0.16, 'sine')
    this.tone(880, 0.18, 0.12, 0.16, 'sine')
  }

  /** Timbre "trip-trip" de radio en loop, hasta stopAlarm(). */
  startAlarm(): void {
    this.unlock()
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.stopAlarm()
    this.ringing = true
    const pattern = () => {
      if (!this.ringing) return
      this.tone(1150, 0, 0.15, 0.3, 'square')
      this.tone(1150, 0.2, 0.15, 0.3, 'square')
      this.tone(1450, 0.48, 0.3, 0.28, 'square')
    }
    pattern()
    this.loopTimer = setInterval(pattern, 1150)
  }

  stopAlarm(): void {
    this.ringing = false
    if (this.loopTimer) {
      clearInterval(this.loopTimer)
      this.loopTimer = null
    }
  }

  isRinging(): boolean {
    return this.ringing
  }
}

export const fleetAlarm = new FleetAlarm()
