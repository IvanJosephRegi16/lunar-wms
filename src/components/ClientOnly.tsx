'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** Renders children only after mount — avoids hydration mismatches from DOM injected before React loads. */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
