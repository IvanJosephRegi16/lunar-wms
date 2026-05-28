import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    
    // Fetch all materials
    const materials = await db.prepare(
      `SELECT * FROM materials ORDER BY material_code ASC`
    ).all() as any[];

    // Fetch all vendors
    const vendors = await db.prepare(
      `SELECT * FROM vendors ORDER BY vendor_name ASC`
    ).all() as any[];

    return NextResponse.json({ success: true, materials, vendors });
  } catch (error: any) {
    console.error('[API MATERIALS GET ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and pm roles are allowed to register raw materials/vendors
    if (user.role !== 'admin' && user.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden: Only Admins or PMs can register materials/vendors' }, { status: 403 });
    }

    const db = getDb();
    const body = await req.json();
    const { type, material_code, material_name, vendor_name, category } = body;

    if (type === 'material') {
      if (!material_code || !material_name) {
        return NextResponse.json({ error: 'Material Code and Material Name are required' }, { status: 400 });
      }

      // Check unique
      const existing = await db.prepare(`SELECT id FROM materials WHERE UPPER(material_code) = UPPER(?)`).get(material_code.trim());
      if (existing) {
        return NextResponse.json({ error: `Material Code '${material_code}' is already registered.` }, { status: 400 });
      }

      await db.prepare(
        `INSERT INTO materials (material_code, material_name, category) VALUES (?, ?, ?)`
      ).run(material_code.trim().toUpperCase(), material_name.trim(), category || 'Uncategorized');

      return NextResponse.json({ success: true, message: 'Material registered successfully' });
    } else if (type === 'vendor') {
      if (!vendor_name) {
        return NextResponse.json({ error: 'Vendor Name is required' }, { status: 400 });
      }

      // Check unique
      const existing = await db.prepare(`SELECT id FROM vendors WHERE UPPER(vendor_name) = UPPER(?)`).get(vendor_name.trim());
      if (existing) {
        return NextResponse.json({ error: `Vendor '${vendor_name}' is already registered.` }, { status: 400 });
      }

      await db.prepare(
        `INSERT INTO vendors (vendor_name) VALUES (?)`
      ).run(vendor_name.trim());

      return NextResponse.json({ success: true, message: 'Vendor registered successfully' });
    } else {
      return NextResponse.json({ error: 'Invalid type parameter. Expected material or vendor.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[API MATERIALS POST ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
