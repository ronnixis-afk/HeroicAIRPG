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

        // Fetch logs with user email for context
        const logs = await prisma.usageLog.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                User: {
                    select: { email: true }
                }
            },
            take: 100 // Limit to last 100 logs for performance
        });

        // Calculate total cost from all logs (not just the last 100)
        const aggregation = await prisma.usageLog.aggregate({
            _sum: {
                costUsd: true,
                tokens: true,
                inputTokens: true,
                outputTokens: true
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
                createdAt: log.createdAt
            })),
            stats: {
                totalCostUsd: aggregation._sum.costUsd || 0,
                totalTokens: aggregation._sum.tokens || 0,
                totalInputTokens: aggregation._sum.inputTokens || 0,
                totalOutputTokens: aggregation._sum.outputTokens || 0
            }
        });
    } catch (error: any) {
        console.error('Error fetching consumption logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
