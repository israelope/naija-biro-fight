// Optional PostHog. Does nothing unless NEXT_PUBLIC_POSTHOG_KEY is set.
let ph: any = null;
let loading = false;

export async function track(event: string, props?: Record<string, unknown>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;
  try {
    if (!ph && !loading) {
      loading = true;
      const mod = await import('posthog-js');
      ph = mod.default;
      ph.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com', capture_pageview: true, persistence: 'localStorage' });
    }
    ph?.capture(event, props);
  } catch { /* analytics must never break the game */ }
}
