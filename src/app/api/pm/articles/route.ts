import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden. PM Access Only.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const viewDeleted = searchParams.get('deleted') === 'true';
    const isDeletedFlag = viewDeleted ? 1 : 0;

    const db = getDb();
    const articles = await db.prepare(`SELECT * FROM articles WHERE is_deleted = ? ORDER BY created_at DESC`).all(isDeletedFlag) as any[];
    
    // Fetch BOM for each article
    for (const article of articles) {
      const bomItems = await db.prepare(`SELECT material_code, material_name FROM article_bom WHERE article_code = ?`).all(article.article_code);
      article.bom = bomItems || [];
    }

    return NextResponse.json({ success: true, articles });
  } catch (error: any) {
    console.error('Failed to fetch articles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden. PM Access Only.' }, { status: 403 });
    }

    const body = await req.json();
    const { article_code, article_name, description, colour, sizes, planned_price, actual_price, image_base64, bom } = body;

    if (!article_code) {
      return NextResponse.json({ error: 'Article Code is required' }, { status: 400 });
    }

    const db = getDb();
    
    await db.transaction(async () => {
      // 1. Insert Article
      await db.prepare(
        `INSERT INTO articles (article_code, article_name, description, colour, sizes, planned_price, actual_price, image_base64, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        article_code, 
        article_name || '', 
        description || '', 
        colour || '', 
        sizes || '', 
        Number(planned_price) || 0,
        Number(actual_price) || 0,
        image_base64 || null, 
        user.id
      );

      // 2. Insert BOM items (Material Code & Name only)
      if (Array.isArray(bom) && bom.length > 0) {
        for (const item of bom) {
          if (!item.material_code) continue;
          await db.prepare(
            `INSERT INTO article_bom (article_code, material_code, material_name, quantity, unit, price_per_unit)
             VALUES (?, ?, ?, 1, 'pcs', 0)` // Storing dummy values for quantity/unit to satisfy old constraint, logic purely uses names now.
          ).run(
            article_code, 
            item.material_code, 
            item.material_name || ''
          );
        }
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'CREATE_ARTICLE',
      module: 'master_data',
      recordId: article_code,
      description: `Created new article ${article_code} with BOM mappings`
    });

    return NextResponse.json({ success: true, message: 'Article created successfully' });
  } catch (error: any) {
    console.error('Failed to create article:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Article code already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden. PM Access Only.' }, { status: 403 });
    }

    const body = await req.json();
    const { original_article_code, article_code, article_name, description, colour, sizes, planned_price, actual_price, image_base64, bom } = body;

    if (!original_article_code || !article_code) {
      return NextResponse.json({ error: 'Article Code is required' }, { status: 400 });
    }

    const db = getDb();
    
    await db.transaction(async () => {
      // 1. Update Article
      await db.prepare(
        `UPDATE articles SET 
          article_code = ?, article_name = ?, description = ?, colour = ?, sizes = ?, planned_price = ?, actual_price = ?, image_base64 = COALESCE(?, image_base64)
         WHERE article_code = ?`
      ).run(
        article_code, 
        article_name || '', 
        description || '', 
        colour || '', 
        sizes || '', 
        Number(planned_price) || 0,
        Number(actual_price) || 0,
        image_base64 || null, 
        original_article_code
      );

      // 2. Replace BOM items
      await db.prepare(`DELETE FROM article_bom WHERE article_code = ?`).run(original_article_code);

      if (Array.isArray(bom) && bom.length > 0) {
        for (const item of bom) {
          if (!item.material_code) continue;
          await db.prepare(
            `INSERT INTO article_bom (article_code, material_code, material_name, quantity, unit, price_per_unit)
             VALUES (?, ?, ?, 1, 'pcs', 0)`
          ).run(
            article_code, 
            item.material_code, 
            item.material_name || ''
          );
        }
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'UPDATE_ARTICLE',
      module: 'master_data',
      recordId: article_code,
      description: `Updated article ${article_code}`
    });

    return NextResponse.json({ success: true, message: 'Article updated successfully' });
  } catch (error: any) {
    console.error('Failed to update article:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden. PM Access Only.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const article_code = searchParams.get('code');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!article_code) {
      return NextResponse.json({ error: 'Article Code is required' }, { status: 400 });
    }

    const db = getDb();
    
    if (hardDelete) {
      await db.prepare(`DELETE FROM articles WHERE article_code = ?`).run(article_code);
    } else {
      await db.prepare(`UPDATE articles SET is_deleted = 1 WHERE article_code = ?`).run(article_code);
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'DELETE_ARTICLE',
      module: 'master_data',
      recordId: article_code,
      description: `Deleted article ${article_code}`
    });

    return NextResponse.json({ success: true, message: 'Article deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete article:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
