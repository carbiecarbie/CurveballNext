/** Room-code prefix symbol -> Fly region. A room lives on the Machine of the region its code names. */
export const REGIONS: Readonly<Record<string, string>> = { G: 'gru', V: 'iad' };
export const REGION_LABELS: Readonly<Record<string, string>> = { gru: 'São Paulo', iad: 'Virginia (US East)' };

/** Normalized code (uppercase, no dashes) -> region name, or undefined when the code carries no region. */
export function regionOfCode(code: string): string | undefined {
  return REGIONS[code.toUpperCase().replaceAll('-', '')[0] ?? ''];
}

/** Prefix symbol for a region name, or undefined for a region without one (local dev, unmapped regions). */
export function prefixOfRegion(region: string | undefined): string | undefined {
  return Object.keys(REGIONS).find(k => REGIONS[k] === region);
}

/** Joining a regional room connects with `?r=<region>` so the ingress can replay the upgrade to the owning Machine. */
export function onlineEndpoint(endpoint: string, operation: 'create' | 'join', code: string): string {
  const region = operation === 'join' ? regionOfCode(code) : undefined;
  return region ? `${endpoint}?r=${region}` : endpoint;
}

/** Plain-language text for a server error code received before the room is joined. */
export const ERROR_TEXT: Readonly<Record<string, string>> = {
  full: 'That room is full or already started.',
  capacity: 'This region is at capacity. Try again in a few minutes.',
  'room-unavailable': 'No such room. Check the code, it may have expired.',
  'invalid-code': 'That is not a valid room code.',
  maintenance: 'The server is restarting. Try again shortly.',
  'retry-later': 'Too many attempts. Wait a moment and try again.',
};
