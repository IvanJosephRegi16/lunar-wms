import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { createGunzip } from 'zlib';

// GET /api/admin/backup/view?file=backup_xxx.json.gz
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const fileName = url.searchParams.get('file');
    if (!fileName) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    const backupDir = path.join(process.cwd(), 'data', 'cloud_backups');
    const filePath = path.join(backupDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
    }

    // Decompress and parse
    const compressed = fs.readFileSync(filePath);
    const decompressed = await new Promise<Buffer>((resolve, reject) => {
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];
      gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);
      gunzip.end(compressed);
    });

    const data = JSON.parse(decompressed.toString('utf-8'));
    
    const targetTable = url.searchParams.get('table');
    if (targetTable) {
      return NextResponse.json({
        file: fileName,
        table: targetTable,
        columns: data[targetTable] && data[targetTable].length > 0 ? Object.keys(data[targetTable][0]) : [],
        data: data[targetTable] || []
      });
    }
    
    // Build a summary of tables and row counts
    const summary: Record<string, { rows: number; columns: string[] }> = {};
    for (const [table, rows] of Object.entries(data)) {
      const rowArr = rows as any[];
      summary[table] = {
        rows: rowArr.length,
        columns: rowArr.length > 0 ? Object.keys(rowArr[0]) : []
      };
    }

    return NextResponse.json({
      file: fileName,
      size: `${(compressed.length / (1024 * 1024)).toFixed(2)} MB`,
      totalTables: Object.keys(summary).length,
      totalRows: Object.values(summary).reduce((a, b) => a + b.rows, 0),
      tables: summary
    });

  } catch (error: any) {
    console.error('Failed to view backup:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
