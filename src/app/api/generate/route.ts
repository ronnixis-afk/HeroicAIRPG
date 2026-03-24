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
        const { model, contents, config, type = 'Response' } = body;

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API Key is not configured.' }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: config
        });

        // Detailed Token Usage Extraction
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;

        // Pricing Logic (Gemini 1.5 Flash / Pro Estimates)
        // Note: These are simplified estimates for demonstration
        let costUsd = 0;
        if (model.includes('pro')) {
            costUsd = (inputTokens * 1.25 / 1000000) + (outputTokens * 3.75 / 1000000);
        } else {
            // Flash pricing
            costUsd = (inputTokens * 0.075 / 1000000) + (outputTokens * 0.30 / 1000000);
        }

        // Atomic Transaction: Update User Credits and Create Usage Log
        try {
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: {
                        currentCredits: {
                            decrement: Math.max(1, Math.ceil(totalTokens / 100)) // 1 credit per 100 tokens
                        }
                    }
                }),
                prisma.usageLog.create({
                    data: {
                        userId: userId,
                        tokens: totalTokens,
                        inputTokens: inputTokens,
                        outputTokens: outputTokens,
                        model: model,
                        type: type, // e.g. 'World Building', 'Market Item', 'Response'
                        costUsd: costUsd
                    }
                })
            ]);
        } catch (err) {
            console.error("Failed to log detailed usage:", err);
        }

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
