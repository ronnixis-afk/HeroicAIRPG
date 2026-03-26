import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '../../../lib/prisma';
import { resolveUserTier, canAccessAI, UserTier } from '../../../lib/tierConfig';
import { isRateLimited } from '../../../lib/rateLimit';

export async function POST(req: NextRequest) {
    try {
        const { userId: authUserId } = await auth();
        let userId = authUserId;

        // Dev-only bypass for agent testing
        if (!userId && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
            userId = 'test-user-id';
        }

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Resolve user tier from Clerk email + DB
        let tier: UserTier = 'newbie';
        let dbUser = null;

        if (userId === 'test-user-id') {
            tier = 'super_admin';
        } else {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            const email = clerkUser.emailAddresses[0]?.emailAddress || '';
            dbUser = await prisma.user.findUnique({ where: { id: userId } });
            tier = resolveUserTier(email, dbUser?.tier);
        }

        if (!canAccessAI(tier)) {
            return NextResponse.json(
                { error: 'AI access is not available for your account tier.' },
                { status: 403 }
            );
        }

        // Rate limiting: prevent API abuse
        if (isRateLimited(userId)) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a moment before trying again.' },
                { status: 429 }
            );
        }

        // Credit pre-check: reject if balance is insufficient (admins bypass)
        if (dbUser && dbUser.currentCredits < 0 && tier !== 'super_admin') {
            return NextResponse.json(
                { error: 'Insufficient credits. Please wait for your credits to replenish.' },
                { status: 402 }
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

        // Pricing Logic (2026 Official Gemini 3.1 & 1.5 Rates)
        let costUsd = 0;
        const modelLower = model.toLowerCase();
        const isImageModel = modelLower.includes('image') || modelLower.includes('vision');
        
        if (isImageModel) {
            // Granular Image Pricing (Imagen 3/4.0)
            if (modelLower.includes('ultra')) costUsd = 0.06;
            else if (modelLower.includes('fast')) costUsd = 0.02;
            else costUsd = 0.04; // Standard / Pro Image
        } else if (modelLower.includes('3.1') && modelLower.includes('pro')) {
            // Gemini 3.1 Pro Preview
            costUsd = (inputTokens * 2.00 / 1000000) + (outputTokens * 12.00 / 1000000);
        } else if (modelLower.includes('3.1') && modelLower.includes('lite')) {
            // Gemini 3.1 Flash-Lite
            costUsd = (inputTokens * 0.25 / 1000000) + (outputTokens * 1.50 / 1000000);
        } else if (modelLower.includes('pro')) {
            // Legacy 1.5 Pro
            costUsd = (inputTokens * 1.25 / 1000000) + (outputTokens * 5.00 / 1000000);
        } else {
            // Flash 1.5 (Standard) pricing
            costUsd = (inputTokens * 0.075 / 1000000) + (outputTokens * 0.30 / 1000000);
        }

        // Atomic Transaction: Update User Credits and Create Usage Log
        if (userId !== 'test-user-id') {
            try {
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: userId },
                        data: {
                            currentCredits: {
                                decrement: isImageModel ? 100 : Math.max(1, Math.ceil(totalTokens / 20)) // 100 credits for images, else 1 per 20 tokens (Calibrated for 2026 costs)
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
    } catch (error: unknown) {
        console.error('Error generating AI content:', error);
        const statusCode = error instanceof Error && error.message?.includes('503') ? 503 : 500;
        return NextResponse.json(
            { error: statusCode === 503 ? 'AI service is temporarily unavailable. Please try again.' : 'An internal error occurred while generating content.' },
            { status: statusCode }
        );
    }
}
