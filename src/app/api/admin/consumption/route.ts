import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '../../../../lib/prisma';
import { resolveUserTier } from '../../../../lib/tierConfig';

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
        const period = searchParams.get('period') || 'today';

        const where: any = {};
        if (typeFilter) where.type = typeFilter;
        if (modelFilter) where.model = modelFilter;

        // Apply period filter
        const now = new Date();
        if (period === 'today') {
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            where.createdAt = { gte: startOfDay };
        } else if (period === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - 7);
            where.createdAt = { gte: startOfWeek };
        } else if (period === 'month') {
            const startOfMonth = new Date(now);
            startOfMonth.setDate(now.getDate() - 30);
            where.createdAt = { gte: startOfMonth };
        }

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

        // Global aggregates (total for the selected period)
        const periodStats = await prisma.usageLog.aggregate({
            where,
            _sum: {
                costUsd: true,
                tokens: true,
                inputTokens: true,
                outputTokens: true
            }
        });

        // Lifetime total (for the "Total Cost" card)
        const lifetimeStats = await prisma.usageLog.aggregate({
            _sum: {
                costUsd: true
            }
        });

        // Dynamic Filters - Get unique types and models from the database
        const [uniqueTypes, uniqueModels] = await Promise.all([
            prisma.usageLog.groupBy({ by: ['type'] }),
            prisma.usageLog.groupBy({ by: ['model'] })
        ]);

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
                totalCostUsd: lifetimeStats._sum.costUsd || 0,
                totalTodayCostUsd: periodStats._sum.costUsd || 0, // In this context "Today" will mean "Period Total"
                totalTokens: periodStats._sum.tokens || 0,
                totalInputTokens: periodStats._sum.inputTokens || 0,
                totalOutputTokens: periodStats._sum.outputTokens || 0
            },
            filters: {
                types: uniqueTypes.map(t => t.type),
                models: uniqueModels.map(m => m.model)
            }
        });
    } catch (error: unknown) {
        console.error('Error fetching consumption logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
