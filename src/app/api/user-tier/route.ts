import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '../../../lib/prisma';
import { resolveUserTier } from '../../../lib/tierConfig';

export async function GET() {
    try {
        const { userId: authUserId } = await auth();
        let userId = authUserId;

        if (!userId && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
            userId = 'test-user-id';
        }

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let email = 'test-hero@example.com';
        let tier = 'super_admin';

        if (userId !== 'test-user-id') {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            email = clerkUser.emailAddresses[0]?.emailAddress || '';
            const dbUser = await prisma.user.findUnique({ where: { id: userId } });
            tier = resolveUserTier(email, dbUser?.tier);
        }

        return NextResponse.json({ email, tier });
    } catch (error: unknown) {
        console.error('Error fetching user tier:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user info.' },
            { status: 500 }
        );
    }
}
