import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;

    const db = getDb();

    // Fetch logs with pagination
    const logs = await db.prepare(`
        SELECT 
            id, sheet_date, article_code, colour, size,
            opening_stock, inward_stock, outward_stock, machine_return_stock, semi_finished_stock,
            closing_stock, remarks, created_at
        FROM daily_stock
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    const totalCount = await db.prepare(`SELECT COUNT(*) as count FROM daily_stock`).get() as { count: string | number };
    const countVal = Number(totalCount.count);

    return NextResponse.json({
        logs,
        pagination: {
            page,
            limit,
            total: countVal,
            totalPages: Math.ceil(countVal / limit)
        }
    });
}
