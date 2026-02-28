// lib/tierConfig.ts
// Resolves user access tiers. SuperAdmin is determined by env var, not DB.

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

export type UserTier = 'newbie' | 'adventurer' | 'hero' | 'super_admin';

/**
 * Resolves a user's effective tier.
 * SuperAdmin is determined by email match against env var (highest priority).
 * All other tiers come from the DB field.
 */
export function resolveUserTier(email: string, dbTier?: string): UserTier {
    if (SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) return 'super_admin';
    if (dbTier && ['adventurer', 'hero'].includes(dbTier)) return dbTier as UserTier;
    return 'newbie';
}

/**
 * Determines if a user tier has access to the Gemini AI API.
 * Currently restricted to super_admin only.
 */
export function canAccessAI(tier: UserTier): boolean {
    return tier === 'super_admin';
}
