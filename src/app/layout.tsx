import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import AppLayoutWrapper from './AppLayoutWrapper';
import FloatingBackground from '@/components/FloatingBackground';
import fs from 'fs';
import path from 'path';
import './globals.css';

export const metadata: Metadata = {
  title: "LUNAR'S VIKING",
  description: 'Enterprise internal warehouse management software',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMaintenance = fs.existsSync(path.join(process.cwd(), '.maintenance'));

  if (isMaintenance) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#f59e0b' }}>⚠️ System Maintenance</h1>
            <p style={{ color: '#a3a3a3' }}>The warehouse ERP is currently undergoing automated deployment or database maintenance.</p>
            <p style={{ color: '#a3a3a3', marginTop: '0.5rem' }}>Please refresh the page in a few moments.</p>
          </div>
        </body>
      </html>
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  let user = null;
  
  if (token) {
    user = await verifyToken(token);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <FloatingBackground />
        <AppLayoutWrapper user={user}>
          {children}
        </AppLayoutWrapper>
      </body>
    </html>
  );
}
