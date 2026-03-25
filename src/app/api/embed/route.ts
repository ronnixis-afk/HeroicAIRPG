import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '../../../lib/prisma';
import { resolveUserTier, canAccessAI } from '../../../lib/tierConfig';
import { AI_MODELS } from '../../../config/aiConfig';
import { isRateLimited } from '../../../lib/rateLimit';

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

        // The JS SDK returns an EmbedContentResponse. The actual float arrays are inside `embeddings[0].values`
        const embeddingValues = response.embeddings?.[0]?.values;

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
