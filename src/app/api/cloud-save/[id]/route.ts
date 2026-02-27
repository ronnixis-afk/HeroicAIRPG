import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const save = await prisma.gameSave.findUnique({
            where: { id }
        });

        if (!save) {
            return NextResponse.json({ error: 'Save not found' }, { status: 404 });
        }

        if (save.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(save);
    } catch (error: any) {
        console.error('Error fetching cloud save:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch cloud save' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const save = await prisma.gameSave.findUnique({
            where: { id }
        });

        if (!save) {
            return NextResponse.json({ error: 'Save not found' }, { status: 404 });
        }

        if (save.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.gameSave.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting cloud save:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to delete cloud save' },
            { status: 500 }
        );
    }
}
