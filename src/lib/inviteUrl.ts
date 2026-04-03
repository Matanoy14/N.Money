/** Detects pure localhost / loopback. */
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/;
/** Detects RFC-1918 private LAN addresses. */
const PRIVATE_LAN_RE = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * 'public'    — link is reachable by anyone on the internet
 * 'lan'       — link works only on the same Wi-Fi / local network
 * 'localhost' — link only works on this exact device
 */
export type InviteScope = 'public' | 'lan' | 'localhost';

export interface InviteUrlResult {
  url: string;
  /** Reachability of the generated link. */
  scope: InviteScope;
  /** @deprecated Use `scope !== 'public'` instead. */
  isLocalOnly: boolean;
}

function originScope(origin: string): InviteScope {
  if (LOCALHOST_RE.test(origin)) return 'localhost';
  if (PRIVATE_LAN_RE.test(origin)) return 'lan';
  return 'public';
}

/**
 * Build an invite URL. Uses VITE_PUBLIC_APP_URL when configured,
 * otherwise falls back to window.location.origin and sets scope accordingly.
 */
export function buildInviteUrl(token: string): InviteUrlResult {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)
    ?.trim().replace(/\/$/, '');
  const origin = window.location.origin;
  const base = configured || origin;
  const scope: InviteScope = configured ? 'public' : originScope(origin);
  return { url: `${base}/invite/${token}`, scope, isLocalOnly: scope !== 'public' };
}

/**
 * Returns the reachability scope of the current browser origin.
 * Use this for proactive warnings before any invite is created.
 */
export function getCurrentOriginScope(): InviteScope {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (configured?.trim()) return 'public';
  return originScope(window.location.origin);
}

/** @deprecated Use getCurrentOriginScope() !== 'public'. */
export function isLocalDevOrigin(): boolean {
  return getCurrentOriginScope() !== 'public';
}
