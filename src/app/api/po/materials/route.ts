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
    const { type, material_code, material_name, vendor_name, category, company_name, address } = body;

    if (type === 'material') {
      if (!material_name) {
        return NextResponse.json({ error: 'Material Name is required' }, { status: 400 });
      }

      const matCode = (material_code || '').trim().toUpperCase();
      
      // Check unique only if code is provided
      if (matCode) {
        const existing = await db.prepare(`SELECT id FROM materials WHERE UPPER(material_code) = ?`).get(matCode);
        if (existing) {
          return NextResponse.json({ error: `Material Code '${matCode}' is already registered.` }, { status: 400 });
        }
      }

      await db.prepare(
        `INSERT INTO materials (material_code, material_name, category) VALUES (?, ?, ?)`
      ).run(matCode, material_name.trim(), category || 'Uncategorized');

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
        `INSERT INTO vendors (vendor_name, company_name, address) VALUES (?, ?, ?)`
      ).run(vendor_name.trim(), (company_name || '').trim(), (address || '').trim());

      return NextResponse.json({ success: true, message: 'Vendor registered successfully' });
    } else {
      return NextResponse.json({ error: 'Invalid type parameter. Expected material or vendor.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[API MATERIALS POST ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden: Only Admins or PMs can delete materials/vendors' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json({ error: 'Missing ID or Type parameter' }, { status: 400 });
    }

    const db = getDb();

    if (type === 'material') {
      await db.prepare(`DELETE FROM materials WHERE id = ?`).run(id);
      return NextResponse.json({ success: true, message: 'Material deleted successfully' });
    } else if (type === 'vendor') {
      await db.prepare(`DELETE FROM vendors WHERE id = ?`).run(id);
      return NextResponse.json({ success: true, message: 'Vendor deleted successfully' });
    } else {
      return NextResponse.json({ error: 'Invalid type parameter.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[API MATERIALS DELETE ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
