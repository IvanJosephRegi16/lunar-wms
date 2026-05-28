import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px', backgroundColor: '#171717', border: '1px solid #333',
        borderRadius: '16px', padding: '40px', textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛑</div>
        <h1 style={{ fontSize: '28px', color: '#ef4444', marginBottom: '16px', fontWeight: 700 }}>Access Denied</h1>
        <p style={{ color: '#a3a3a3', marginBottom: '32px', lineHeight: '1.6' }}>
          You do not have the required enterprise permissions to view this module.
          If you believe this is an error, please contact your system administrator.
        </p>
        
        <Link 
          href="/" 
          style={{
            display: 'inline-block', padding: '12px 24px', backgroundColor: '#2563eb',
            color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 600,
            transition: 'background 0.2s ease'
          }}
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
