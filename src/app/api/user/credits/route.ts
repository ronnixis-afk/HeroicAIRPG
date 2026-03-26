import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const { userId: authUserId } = await auth();
        let userId = authUserId;

        if (!userId && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
            return NextResponse.json({ currentCredits: 1000, maxCredits: 1000 });
        }

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
