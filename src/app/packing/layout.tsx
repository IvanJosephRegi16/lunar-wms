'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

export default function PackingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Scanning Intake', href: '/packing/scanning', icon: '⚡' },
    { name: 'Manual Entry', href: '/packing/manual', icon: '📝' },
  ];

  return (
    <div className={styles.packingContainer}>
      <div className={styles.tabNav}>
        {tabs.map(tab => (
          <Link 
            key={tab.href} 
            href={tab.href}
            className={`${styles.tab} ${pathname.includes(tab.href) ? styles.active : ''}`}
          >
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.name}</span>
          </Link>
        ))}
      </div>
      
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
