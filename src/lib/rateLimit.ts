// lib/rateLimit.ts
// Simple in-memory rate limiter for API routes.
// Tracks requests per user with a sliding window.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS = 30;  // 30 requests per minute per user

/**
 * Checks if a user has exceeded their rate limit.
 * Returns true if the request should be BLOCKED, false if allowed.
 */
export function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + WINDOW_MS });
        return false;
    }

    entry.count++;
    if (entry.count > MAX_REQUESTS) {
        return true;
    }

    return false;
}

// Periodic cleanup to prevent memory leaks (runs every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60_000);
