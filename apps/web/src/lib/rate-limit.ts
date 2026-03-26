/**
 * In-memory rate limiter using a sliding window approach.
 *
 * Each token (typically an IP address) gets a counter that resets after
 * the configured interval. Expired entries are cleaned up periodically
 * to prevent memory leaks.
 */

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

interface RateLimiter {
  check(limit: number, token: string): Promise<void>;
}

export function rateLimit(options: {
  interval: number;
  uniqueTokenPerInterval: number;
}): RateLimiter {
  const tokenCache = new Map<string, RateLimitEntry>();

  // Clean up expired entries every interval
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of tokenCache) {
      if (entry.expiresAt <= now) {
        tokenCache.delete(key);
      }
    }
    // If the cache grows beyond the max unique tokens, evict oldest entries
    if (tokenCache.size > options.uniqueTokenPerInterval) {
      const entries = Array.from(tokenCache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toRemove = entries.length - options.uniqueTokenPerInterval;
      for (let i = 0; i < toRemove; i++) {
        tokenCache.delete(entries[i][0]);
      }
    }
  }, options.interval);

  // Allow the interval to not block Node.js process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return {
    async check(limit: number, token: string): Promise<void> {
      const now = Date.now();
      const entry = tokenCache.get(token);

      if (!entry || entry.expiresAt <= now) {
        // First request or expired window — start a new window
        tokenCache.set(token, {
          count: 1,
          expiresAt: now + options.interval,
        });
        return;
      }

      // Within the current window
      if (entry.count >= limit) {
        const retryAfterMs = entry.expiresAt - now;
        const error = new Error('Rate limit exceeded');
        (error as any).statusCode = 429;
        (error as any).retryAfterMs = retryAfterMs;
        throw error;
      }

      entry.count += 1;
    },
  };
}

/**
 * Extract IP address from a NextRequest for rate limiting.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

// ─── Pre-configured rate limiters for critical routes ───────────────────────

/** /api/extensions/publish — 5 requests per minute */
export const publishLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/billing/checkout — 10 requests per minute */
export const checkoutLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/billing/donate — 10 requests per minute */
export const donateLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/extensions/[id]/download GET — 60 requests per minute */
export const downloadLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/trial/start — 10 requests per minute */
export const trialLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/extensions/[id]/reviews POST — 5 requests per minute */
export const reviewLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/extensions GET — 60 requests per minute */
export const extensionsListLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/categories GET — 60 requests per minute */
export const categoriesLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/extensions/[id] GET — 120 requests per minute */
export const extensionDetailLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/extensions/[id]/purchase POST — 10 requests per minute */
export const purchaseLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });

/** /api/extensions/[id]/verify GET — 120 requests per minute */
export const verifyLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 50 });
