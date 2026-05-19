/**
 * Analytics service layer — no third-party SDK, no ATT, no health content.
 * Events are debug-logged in development; no-op in production until a provider is wired.
 */

export type AnalyticsEventName =
  | 'app_open'
  | 'onboarding_complete'
  | 'signup'
  | 'login'
  | 'pet_created'
  | 'reminder_created'
  | 'ai_used'
  | 'premium_view'
  | 'premium_upgrade_click';

/** Safe, non-sensitive event properties only. */
export type AnalyticsEventProps = Record<string, string | number | boolean | null | undefined>;

const ALLOWED_KEYS = new Set([
  'source',
  'mode',
  'plan',
  'feature',
  'reason',
  'locale',
  'count',
]);

function sanitizeProps(props?: AnalyticsEventProps): AnalyticsEventProps | undefined {
  if (!props) return undefined;
  const out: AnalyticsEventProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type AnalyticsProvider = {
  track: (name: AnalyticsEventName, props?: AnalyticsEventProps) => void;
};

class ConsoleDebugAnalyticsProvider implements AnalyticsProvider {
  track(name: AnalyticsEventName, props?: AnalyticsEventProps): void {
    if (!import.meta.env.DEV) return;
    const safe = sanitizeProps(props);
    if (safe) console.debug('[analytics]', name, safe);
    else console.debug('[analytics]', name);
  }
}

class NoopAnalyticsProvider implements AnalyticsProvider {
  track(): void {
    // Reserved for future Firebase / Amplitude / etc.
  }
}

class AnalyticsService {
  private provider: AnalyticsProvider;

  constructor() {
    this.provider = import.meta.env.DEV
      ? new ConsoleDebugAnalyticsProvider()
      : new NoopAnalyticsProvider();
  }

  setProvider(provider: AnalyticsProvider): void {
    this.provider = provider;
  }

  track(name: AnalyticsEventName, props?: AnalyticsEventProps): void {
    try {
      this.provider.track(name, sanitizeProps(props));
    } catch {
      // Never break app flows for analytics
    }
  }
}

export const analytics = new AnalyticsService();

export function trackEvent(name: AnalyticsEventName, props?: AnalyticsEventProps): void {
  analytics.track(name, props);
}
