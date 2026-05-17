'use client';

import AppLayout from '@/components/AppLayout';

export default function AppLayoutWrapper({ children, user }: { children: React.ReactNode, user: any }) {
  if (!user) return <>{children}</>;
  return <AppLayout user={user}>{children}</AppLayout>;
}
