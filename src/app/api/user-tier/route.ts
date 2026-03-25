import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '../../../lib/prisma';
import { resolveUserTier } from '../../../lib/tierConfig';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress || '';
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        const tier = resolveUserTier(email, dbUser?.tier);

        return NextResponse.json({ email, tier });
    } catch (error: unknown) {
        console.error('Error fetching user tier:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user info.' },
            { status: 500 }
        );
    }
}
