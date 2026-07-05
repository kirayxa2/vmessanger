/**
 * LRU Rate Limiter with TTL — no Redis needed.
 * Auto-cleans expired entries every 60s to prevent memory leaks.
 */
export class RateLimiter {
  private map = new Map<string, { count: number; resetAt: number }>()
  private readonly maxRequests: number
  private readonly windowMs: number
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    // Auto-cleanup every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
    // Ensure cleanup doesn't prevent process exit
    if (this.cleanupInterval.unref) this.cleanupInterval.unref()
  }

  /**
   * Check if a request is allowed for the given key.
   * Returns { allowed, remaining, resetAt }
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.map.get(key)

    if (!entry || now > entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs }
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return { allowed: true, remaining: this.maxRequests - entry.count, resetAt: entry.resetAt }
  }

  /**
   * Simple boolean check — returns true if allowed
   */
  isAllowed(key: string): boolean {
    return this.check(key).allowed
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.map) {
      if (now > entry.resetAt) this.map.delete(key)
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.map.clear()
  }
}

// ── Pre-configured limiters ───────────────────────────────────────

/** Login: max 10 attempts per key per 5 minutes */
export const loginLimiter = new RateLimiter(10, 5 * 60_000)

/** Registration: max 5 per IP per hour */
export const registerLimiter = new RateLimiter(5, 60 * 60_000)

/** Messages: max 30 per user per minute */
export const messageLimiter = new RateLimiter(30, 60_000)

/** Admin login: max 5 attempts per key per 15 minutes (higher stakes than regular login) */
export const adminLoginLimiter = new RateLimiter(5, 15 * 60_000)

/** Employee login: max 10 attempts per key per 5 minutes */
export const employeeLoginLimiter = new RateLimiter(10, 5 * 60_000)
