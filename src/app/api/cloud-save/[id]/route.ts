import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '../../../../lib/prisma';

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
    } catch (error: unknown) {
        console.error('Error fetching cloud save:', error);
        return NextResponse.json(
            { error: 'Failed to fetch cloud save.' },
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
    } catch (error: unknown) {
        console.error('Error deleting cloud save:', error);
        return NextResponse.json(
            { error: 'Failed to delete cloud save.' },
            { status: 500 }
        );
    }
}
