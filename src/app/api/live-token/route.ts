import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { PrismaClient } from '../../../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveUserTier, canAccessAI } from '../../../lib/tierConfig';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Generates a short-lived ephemeral token for the Gemini Live API.
 * The client uses this token to connect directly to the Live API WebSocket
 * without exposing the server-side API key.
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Resolve user tier from Clerk email + DB
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress || '';
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        const tier = resolveUserTier(email, dbUser?.tier);

        if (!canAccessAI(tier)) {
            return NextResponse.json(
                { error: 'AI access is not available for your account tier.' },
                { status: 403 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const token = await (ai as any).authTokens.create({
            config: {
                uses: 1,
                expireTime: expireTime,
                newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
                httpOptions: { apiVersion: 'v1alpha' },
            }
        });

        return NextResponse.json({
            token: token.name,
            expiresAt: expireTime,
        });
    } catch (error: any) {
        console.error('Error generating Live API token:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate Live API token' },
            { status: 500 }
        );
    }
}
