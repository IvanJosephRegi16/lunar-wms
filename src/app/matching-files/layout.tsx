import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { MatchingProvider } from '@/lib/matching-files/store';

export default async function MatchingFilesLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  
  if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
    // Isolated, unauthorized users get bounced immediately before rendering anything
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1 style={{ color: '#dc2626', fontSize: '32px', fontWeight: 900 }}>Access Denied</h1>
        <p style={{ color: '#64748b' }}>Only Administrators and Supervisors can access the Enterprise Comparison Center.</p>
      </div>
    );
  }

  return (
    <MatchingProvider>
      {children}
    </MatchingProvider>
  );
}
