import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import AppLayoutWrapper from './AppLayoutWrapper';
import FloatingBackground from '@/components/FloatingBackground';
import fs from 'fs';
import path from 'path';
import './globals.css';

import type { Viewport } from 'next';

export const metadata: Metadata = {
  title: "Lunar's Viking",
  description: 'Enterprise internal warehouse management software',
  applicationName: "Lunar's Viking",
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: "Lunar's Viking",
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered: ', registration.scope);
                  }, function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
        <FloatingBackground />
        <AppLayoutWrapper user={user}>
          {children}
        </AppLayoutWrapper>
      </body>
    </html>
  );
}
