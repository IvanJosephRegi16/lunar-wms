'use client';

import { useEffect } from 'react';

// VAPID public key (we use a simple web push setup without VAPID for simplicity,
// but include the infrastructure for future VAPID upgrade)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_KEY || '';

export default function PushNotificationSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.ready;

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Subscribe to push
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // applicationServerKey is optional for basic web push; set if using VAPID
          ...(VAPID_PUBLIC_KEY ? { applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) } : {}),
        });

        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });

        console.log('[PUSH] Subscribed successfully');
      } catch (err) {
        console.log('[PUSH] Could not subscribe:', err);
      }
    }

    // Delay slightly so SW is fully active
    setTimeout(registerPush, 2000);
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}
