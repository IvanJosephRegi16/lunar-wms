'use client';

import AppLayout from '@/components/AppLayout';
import SessionGuard from '@/components/SessionGuard';

export default function AppLayoutWrapper({ children, user }: { children: React.ReactNode, user: any }) {
  if (!user) return <>{children}</>;
  return (
    <SessionGuard user={user}>
      <AppLayout user={user}>{children}</AppLayout>
    </SessionGuard>
  );
}
