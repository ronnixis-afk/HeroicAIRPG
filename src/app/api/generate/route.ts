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

        const body = await req.json();
        const { model, contents, config } = body;

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Forward the entire config object from the client to the Gemini SDK.
        // The client sends: { model, contents, config: { systemInstruction, responseMimeType, responseSchema, tools, thinkingConfig, ... } }
        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: config
        });

        const tokenCount = response.usageMetadata?.totalTokenCount || 0;

        // Non-blocking Usage Sync
        Promise.all([
            prisma.user.upsert({
                where: { id: userId },
                update: {},
                create: { id: userId, email: "hidden@supabase.clerk" }
            }),
            prisma.usageLog.create({
                data: {
                    userId: userId,
                    tokens: tokenCount
                }
            })
        ]).catch(err => console.error("Failed to log usage:", err));

        return NextResponse.json({
            text: response.text,
            usageMetadata: response.usageMetadata,
            candidates: response.candidates
        });
    } catch (error: any) {
        console.error('Error generating AI content:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate content' },
            { status: 500 }
        );
    }
}
