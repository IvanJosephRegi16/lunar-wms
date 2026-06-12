import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await pgPool.connect();
    try {
      // Ensure the table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS custom_material_categories (
          id SERIAL PRIMARY KEY,
          category_name TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      const result = await client.query(`SELECT category_name FROM custom_material_categories ORDER BY category_name ASC`);
      return NextResponse.json({ categories: result.rows.map((r: any) => r.category_name) });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[CATEGORIES GET ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'pm') {
      return NextResponse.json({ error: 'Only Admin or PM can add categories' }, { status: 403 });
    }

    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });

    const client = await pgPool.connect();
    try {
      await client.query(
        `INSERT INTO custom_material_categories (category_name) VALUES ($1) ON CONFLICT (category_name) DO NOTHING`,
        [name]
      );
      return NextResponse.json({ success: true, category_name: name });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[CATEGORIES POST ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'pm') {
      return NextResponse.json({ error: 'Only Admin or PM can delete categories' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'Category name required' }, { status: 400 });

    const client = await pgPool.connect();
    try {
      await client.query(`DELETE FROM custom_material_categories WHERE category_name = $1`, [name]);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[CATEGORIES DELETE ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
