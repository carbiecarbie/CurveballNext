export const PROFILE = Object.freeze({
  id: 'm1-provisional-01', left: 25, top: 25, width: 301, height: 201,
  order: 'lifecycle → commands → player → enemy → ball', edges: 'closed',
  quantization: 'identity', retry: 'retain paddles; replace ball', missHold: 19,
});
export type Profile = typeof PROFILE;
export function field(p: Profile = PROFILE) {
  return { left: p.left, right: p.left + p.width, top: p.top, bottom: p.top + p.height,
    x: p.left + p.width / 2, y: p.top + p.height / 2 };
}
