import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
// @ts-ignore
import { Pool } from 'pg';
import { createGzip } from 'zlib';
import { Writable } from 'stream';

// Re-use the shared PostgreSQL pool for backup queries
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST(req: Request) {
  try {
    // Accept cron token OR admin session
    const authHeader = req.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET || 'lunar-backup-secret'}`;

    if (!isCron) {
      const user = await getAuthUser();
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 1. Query all tables in the public schema
    const tablesRes = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const backupData: Record<string, any[]> = {};
    const tableSummary: Record<string, number> = {};

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      try {
        const dataRes = await pgPool.query(`SELECT * FROM "${tableName}"`);
        backupData[tableName] = dataRes.rows;
        tableSummary[tableName] = dataRes.rows.length;
      } catch {
        tableSummary[tableName] = 0;
      }
    }

    // 2. Compress to gzip in memory
    const jsonString = JSON.stringify(backupData, null, 2);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const gzip = createGzip();
      const writable = new Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); }
      });
      gzip.on('error', reject);
      writable.on('finish', resolve);
      gzip.pipe(writable);
      gzip.write(jsonString);
      gzip.end();
    });

    const compressed = Buffer.concat(chunks);
    const mbSize = (compressed.byteLength / (1024 * 1024)).toFixed(2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.json.gz`;

    // 3. Upload to Google Drive
    let driveLink = null;
    try {
      // Import here to avoid issues if not installed
      const { google } = require('googleapis');
      const { GOOGLE_SERVICE_ACCOUNT, GOOGLE_DRIVE_FOLDER_ID } = require('@/lib/googleServiceAccount');
      
      const jwtClient = new google.auth.JWT(
        GOOGLE_SERVICE_ACCOUNT.client_email,
        undefined,
        GOOGLE_SERVICE_ACCOUNT.private_key,
        ['https://www.googleapis.com/auth/drive.file']
      );
      
      const drive = google.drive({ version: 'v3', auth: jwtClient });
      
      // We need a readable stream for the upload
      const { Readable } = require('stream');
      const media = {
        mimeType: 'application/gzip',
        body: Readable.from(compressed)
      };
      
      const fileMetadata = {
        name: fileName,
        parents: [GOOGLE_DRIVE_FOLDER_ID]
      };
      
      const driveRes = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });
      
      driveLink = driveRes.data.webViewLink;
    } catch (e: any) {
      console.error('Failed to upload to Google Drive:', e);
      // We can continue and just return it as a download if upload fails
    }

    // 4. Log backup timestamp to database
    try {
      const db = getDb();
      await db.prepare(
        `INSERT INTO system_settings ("key", value) VALUES (?, ?) ON CONFLICT("key") DO UPDATE SET value = ?`
      ).run('last_cloud_backup', new Date().toISOString(), new Date().toISOString());
    } catch (e) {
      console.warn('Could not log backup timestamp:', e);
    }

    // 5. Return success or file (depending on if they hit it from UI or cron)
    // For now we still return the file so the UI download works, but now it's ALSO in Drive!
    // Or we could return a JSON success if the Drive upload worked? Let's keep returning the file
    // so the admin still gets a local copy, but the cron job can just ignore the body.
    return new Response(compressed, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Backup-Tables': String(Object.keys(tableSummary).length),
        'X-Backup-Rows': String(Object.values(tableSummary).reduce((a, b) => a + b, 0)),
        'X-Backup-Size-MB': mbSize,
        'X-Drive-Link': driveLink || '',
      },
    });

  } catch (error: any) {
    console.error('Backup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — returns metadata about the last backup time
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let lastBackup = null;
    try {
      const db = getDb();
      const row = await db.prepare(`SELECT value FROM system_settings WHERE "key" = ?`).get('last_cloud_backup');
      lastBackup = (row as any)?.value ?? null;
    } catch { /* table may not exist yet */ }

    // Count total rows across all tables
    const tablesRes = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tableSummary: Record<string, number> = {};
    for (const row of tablesRes.rows) {
      try {
        const cnt = await pgPool.query(`SELECT COUNT(*) as c FROM "${row.table_name}"`);
        tableSummary[row.table_name] = Number(cnt.rows[0].c);
      } catch { tableSummary[row.table_name] = 0; }
    }

    return NextResponse.json({
      lastBackup,
      tables: tableSummary,
      totalTables: Object.keys(tableSummary).length,
      totalRows: Object.values(tableSummary).reduce((a, b) => a + b, 0),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
