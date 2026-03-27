import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '../../../lib/prisma';
import { resolveUserTier, canAccessAI, UserTier } from '../../../lib/tierConfig';
import { AI_MODELS } from '../../../config/aiConfig';
import { isRateLimited } from '../../../lib/rateLimit';

export async function POST(req: NextRequest) {
    try {
        let { userId } = await auth();

        // Dev-only bypass for agent testing
        if (!userId && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
            userId = 'test-user-id';
        }

        if (!userId) {
            console.error('[EMBED] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let tier: UserTier = 'newbie';
        let email = '';

        if (userId === 'test-user-id') {
            tier = 'super_admin';
            email = 'test-qc@example.com';
        } else {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            email = clerkUser.emailAddresses[0]?.emailAddress || '';
            const dbUser = await prisma.user.findUnique({ where: { id: userId } });
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

        const body = await req.json();
        const { text, model = AI_MODELS.EMBEDDING } = body;

        if (!text) {
            return NextResponse.json({ error: 'Text is required for embedding.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.embedContent({
            model: model,
            contents: text
        });

        // The SDK returns EmbedContentResponse with an 'embedding' property for single requests.
        const embeddingValues = (response as any).embedding?.values;

        if (!embeddingValues) {
            throw new Error("Failed to extract embedding array from API response.");
        }

        return NextResponse.json({
            embedding: embeddingValues
        });
    } catch (error: unknown) {
        console.error('Error generating embedding:', error);
        return NextResponse.json(
            { error: 'An internal error occurred while generating the embedding.' },
            { status: 500 }
        );
    }
}
