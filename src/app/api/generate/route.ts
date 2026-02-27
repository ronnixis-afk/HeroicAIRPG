import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { model, contents, systemInstruction, tools, generationConfig } = body;

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Ensure we are passing valid fields to the SDK request
        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                tools: tools,
                responseMimeType: generationConfig?.responseMimeType,
                temperature: generationConfig?.temperature,
                topP: generationConfig?.topP,
                topK: generationConfig?.topK,
                candidateCount: generationConfig?.candidateCount,
                maxOutputTokens: generationConfig?.maxOutputTokens,
            }
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

        return NextResponse.json({ text: response.text });
    } catch (error: any) {
        console.error('Error generating AI content:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate content' },
            { status: 500 }
        );
    }
}
