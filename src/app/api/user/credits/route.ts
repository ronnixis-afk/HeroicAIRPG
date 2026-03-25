import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { currentCredits: true, maxCredits: true }
        });

        if (!user) {
            return NextResponse.json({ currentCredits: 0, maxCredits: 1000 });
        }

        return NextResponse.json(user);
    } catch (error: unknown) {
        console.error('Error fetching credits:', error);
        return NextResponse.json({ error: 'Failed to fetch credits.' }, { status: 500 });
    }
}
