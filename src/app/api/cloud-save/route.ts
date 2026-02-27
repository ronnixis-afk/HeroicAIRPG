import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '../../../generated/prisma';
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

        // Fetch just the metadata for the list view, omitting the potentially massive `data` JSON
        const saves = await prisma.gameSave.findMany({
            where: { userId },
            select: {
                id: true,
                worldId: true,
                name: true,
                updatedAt: true,
                createdAt: true
            },
            orderBy: {
                updatedAt: 'desc' // Most recent saves first
            }
        });

        return NextResponse.json(saves);
    } catch (error: any) {
        console.error('Error fetching cloud saves:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch cloud saves' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { worldId, name, data } = body;

        if (!worldId || !name || !data) {
            return NextResponse.json({ error: 'Missing required payload: worldId, name, data' }, { status: 400 });
        }

        // We use upsert so they can overwrite a single master save per World ID.
        // If we want them to have multiple save slots, we could just `create` and require the frontend
        // to manage deletion of old ones. For simplicity, let's tie it to the worldId to mimic local IndexedDB behavior,
        // so 1 world = 1 primary cloud save.

        let existingSave = await prisma.gameSave.findFirst({
            where: {
                userId,
                worldId
            }
        });

        let save;

        // Ensure user is created in our db
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, email: "hidden@supabase.clerk" }
        });

        if (existingSave) {
            save = await prisma.gameSave.update({
                where: { id: existingSave.id },
                data: {
                    name,
                    data
                }
            });
        } else {
            save = await prisma.gameSave.create({
                data: {
                    userId,
                    worldId,
                    name,
                    data
                }
            });
        }

        return NextResponse.json({ success: true, id: save.id });
    } catch (error: any) {
        console.error('Error saving to cloud:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to save to cloud' },
            { status: 500 }
        );
    }
}
