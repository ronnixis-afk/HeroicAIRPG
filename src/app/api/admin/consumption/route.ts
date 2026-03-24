import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { PrismaClient } from '../../../../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveUserTier } from '../../../../lib/tierConfig';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET(req: NextRequest) {
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

        if (tier !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const typeFilter = searchParams.get('type');
        const modelFilter = searchParams.get('model');

        const where: any = {};
        if (typeFilter) where.type = typeFilter;
        if (modelFilter) where.model = modelFilter;

        // Fetch logs with filters
        const logs = await prisma.usageLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                User: {
                    select: { email: true }
                }
            },
            take: 100
        });

        // Global aggregates
        const globalStats = await prisma.usageLog.aggregate({
            _sum: {
                costUsd: true,
                tokens: true,
                inputTokens: true,
                outputTokens: true
            }
        });

        // Today's aggregates (Local Server Time)
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todayStats = await prisma.usageLog.aggregate({
            where: {
                createdAt: { gte: startOfToday }
            },
            _sum: {
                costUsd: true
            }
        });

        return NextResponse.json({
            logs: logs.map((log: any) => ({
                id: log.id,
                email: log.User.email,
                type: log.type,
                model: log.model,
                inputTokens: log.inputTokens,
                outputTokens: log.outputTokens,
                totalTokens: log.tokens,
                costUsd: log.costUsd,
                durationMs: log.durationMs,
                createdAt: log.createdAt
            })),
            stats: {
                totalCostUsd: globalStats._sum.costUsd || 0,
                totalTodayCostUsd: todayStats._sum.costUsd || 0,
                totalTokens: globalStats._sum.tokens || 0,
                totalInputTokens: globalStats._sum.inputTokens || 0,
                totalOutputTokens: globalStats._sum.outputTokens || 0
            }
        });
    } catch (error: any) {
        console.error('Error fetching consumption logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
