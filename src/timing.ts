import type { FooterAssistant, FooterStatus, TimingSnapshot } from "./contracts"
import { nonnegative, outputTokens } from "./metrics"

/** A pure clock: the UI owns scheduling and disposal; adapters opt in to actual streaming deltas. */
export class FooterClock {
  private key?: string
  private message?: string
  private started?: number
  private running = false
  private previous?: { count: number; time: number }
  private samples: { count: number; milliseconds: number }[] = []
  private snapshot: TimingSnapshot = {}

  reset(): void {
    this.key = undefined
    this.message = undefined
    this.started = undefined
    this.running = false
    this.previous = undefined
    this.samples = []
    this.snapshot = {}
  }

  update(key: string, status: FooterStatus, last: FooterAssistant | undefined, now: number, liveTokenDeltas: boolean): TimingSnapshot {
    if (this.key !== key) { this.reset(); this.key = key }
    if (!Number.isFinite(now) || now < 0) return this.snapshot
    const active = status === "running" || status === "retry"
    if (active && !this.running) {
      const created = nonnegative(last?.createdAt)
      // A completed response belongs to the preceding run, even if the message is still visible.
      this.started = created !== undefined && created <= now && last?.completedAt === undefined ? created : now
      this.previous = undefined
      this.samples = []
      this.snapshot = {}
    }
    if (this.message !== last?.id) {
      this.message = last?.id
      this.previous = undefined
      this.samples = []
      this.snapshot.tps = undefined
    }
    const elapsed = this.started === undefined ? undefined : Math.max(0, Math.floor((now - this.started) / 1000))
    if (active || this.running) this.snapshot.elapsed = elapsed
    const count = outputTokens(last?.tokens)
    if (liveTokenDeltas) {
      if (active && count !== undefined) {
        const previous = this.previous
        if (previous && count >= previous.count && now > previous.time) {
          const delta = count - previous.count
          const milliseconds = now - previous.time
          if (delta > 0) {
            this.samples.push({ count: delta, milliseconds })
            if (this.samples.length > 120) this.samples.shift()
            this.snapshot.tps = { value: delta / milliseconds * 1000, live: true }
          }
        } else if (previous && count < previous.count) {
          this.samples = []
          this.snapshot.tps = undefined
        }
        this.previous = { count, time: now }
      }
      if (!active && this.samples.length) {
        const total = this.samples.reduce((a, b) => ({ count: a.count + b.count, milliseconds: a.milliseconds + b.milliseconds }), { count: 0, milliseconds: 0 })
        this.snapshot.tps = { value: total.count / total.milliseconds * 1000, live: false }
      }
    } else {
      const start = nonnegative(last?.createdAt)
      const end = nonnegative(last?.streamedAt)
      const value = count !== undefined && start !== undefined && end !== undefined && end > start ? count / (end - start) * 1000 : undefined
      this.snapshot.tps = value !== undefined && Number.isFinite(value) ? { value, live: false } : undefined
    }
    if (status === undefined) { this.started = undefined; this.snapshot.elapsed = undefined }
    this.running = active
    return { ...this.snapshot }
  }
}
