import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '../../../../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
    } catch (error: any) {
        console.error('Error fetching credits:', error);
        return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }
}
