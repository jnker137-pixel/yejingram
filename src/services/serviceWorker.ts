export async function ensureAppServiceWorkerRegistered(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const hasSw = regs.some((r) => {
            const scriptUrls = [r.active?.scriptURL, r.installing?.scriptURL, r.waiting?.scriptURL].filter(Boolean) as string[];
            return scriptUrls.some((u) => u.endsWith('/sw-cache.js'));
        });

        if (!hasSw) {
            await navigator.serviceWorker.register('/sw-cache.js');
        }
    } catch {
        // Ignore registration failures (e.g., unsupported context or blocked SW).
    }
}

const VAPID_PUBLIC_KEY = 'BKMCVDQ4x3TccDE1Oi3MfrY-4i2fGWA0mPrdqf0DgaLX6movUljKBlMlMuzcp-kArUGydXRIYIeKZAXoPas-LEo';
const SUPABASE_URL = 'https://uxiymaeobmleshekvqvl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXltYWVvYm1sZXNoZWt2cXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTQ3OTYsImV4cCI6MjA4NzEzMDc5Nn0.cAltB-U4B7-38M065Cn30uwoPu-wzh62IkuDUT4rrAQ';

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

export async function subscribeToPush(clientId: string = 'seongmin'): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        if (Notification.permission === 'denied') return;
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
        }

        const regs = await navigator.serviceWorker.getRegistrations();
        let pushReg = regs.find(r =>
            [r.active?.scriptURL, r.installing?.scriptURL, r.waiting?.scriptURL]
                .filter(Boolean).some(u => u?.endsWith('/sw-push.js'))
        );
        if (!pushReg) {
            pushReg = await navigator.serviceWorker.register('/sw-push.js');
        }
        await navigator.serviceWorker.ready;

        let sub = await pushReg.pushManager.getSubscription();
        if (!sub) {
            sub = await pushReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
            });
        }

        const subJson = sub.toJSON();
        const keys = subJson.keys as Record<string, string> | undefined;

        await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
                endpoint: subJson.endpoint,
                p256dh: keys?.p256dh || '',
                auth: keys?.auth || '',
                client_id: clientId,
            }),
        });

        console.log('[push] 구독 등록 완료');
    } catch (err) {
        console.warn('[push] 구독 실패:', err);
    }
}
