export const PROFILE = Object.freeze({
  id: 'm4-ruffle-06-01', left: 25, top: 25, width: 301, height: 201,
  order: 'lifecycle → commands → ball → enemy → player', edges: 'closed',
  quantization: 'ruffle-0.6 axis-aligned twips/f32; device-pixel mouse', retry: 'retain paddles; deferred automatic ball Load', missHold: 19,
});
export type Profile = typeof PROFILE;
export function field(p: Profile = PROFILE) {
  return { left: p.left, right: p.left + p.width, top: p.top, bottom: p.top + p.height,
    x: p.left + p.width / 2, y: p.top + p.height / 2 };
}
