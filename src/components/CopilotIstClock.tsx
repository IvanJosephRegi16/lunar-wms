'use client';

import { useEffect, useState } from 'react';
import { formatNowIST } from '@/lib/utils';

/** Live IST clock for the chatbot header (client-only). */
export default function CopilotIstClock() {
  const [now, setNow] = useState(formatNowIST);

  useEffect(() => {
    const tick = () => setNow(formatNowIST());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        fontSize: '10px',
        opacity: 0.75,
        marginTop: '3px',
        lineHeight: 1.4,
        fontWeight: 500,
      }}
      title="Indian Standard Time — Mumbai (Asia/Kolkata)"
    >
      🕐 {now}
    </div>
  );
}
