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
        
        const startTime = Date.now();
        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: config
        });
        const durationMs = Date.now() - startTime;

        // Detailed Token Usage Extraction
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;

        // Pricing Logic (2026 Official Rates)
        let costUsd = 0;
        const modelLower = model.toLowerCase();
        const isImageModel = modelLower.includes('image') || modelLower.includes('vision');
        
        if (isImageModel) {
            // Granular Image Pricing
            if (modelLower.includes('ultra')) costUsd = 0.06;
            else if (modelLower.includes('fast')) costUsd = 0.02;
            else costUsd = 0.04; // Standard / Pro Image
        } else if (modelLower.includes('pro')) {
            costUsd = (inputTokens * 1.25 / 1000000) + (outputTokens * 5.00 / 1000000);
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
                            decrement: isImageModel ? 100 : Math.max(1, Math.ceil(totalTokens / 50)) // 100 credits for images, else 1 per 50 tokens
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
                        type: type, 
                        costUsd: costUsd,
                        durationMs: durationMs
                    }
                })
            ]);
        } catch (err) {
            console.error("Failed to log detailed usage:", err);
        }

        // Support for both Text and InlineData (Images)
        let textResult = '';
        try { textResult = response.text || ''; } catch(e) { /* ignore if not text */ }

        return NextResponse.json({
            text: textResult,
            usageMetadata: response.usageMetadata,
            candidates: response.candidates,
            durationMs: durationMs
        });
    } catch (error: any) {
        console.error('Error generating AI content:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate content' },
            { status: 500 }
        );
    }
}
