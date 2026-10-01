// Independent written equations. No production math, installer, mapping or collision imports.
export function expectedBox(x: number, y: number, z: number, width: number, height: number): [number, number, number, number] {
  const g = (90 - Math.atan(z / 31.066017) * 180 / 3.141592653589793) / 90;
  const even = (v: number) => { const a = Math.floor(v); return v - a === .5 ? a % 2 === 0 ? a : a + 1 : Math.round(v); };
  const tx = Math.trunc((175.5 + x * g) * 20), ty = Math.trunc((125.5 + (y - 125.5) * g) * 20);
  const hx = even(Math.fround(Math.fround((width * g) / width) * Math.fround(width * 10)));
  const hy = even(Math.fround(Math.fround((height * g) / height) * Math.fround(height * 10)));
  return [tx - hx, tx + hx, ty - hy, ty + hy];
}
export function expectedHit(a: number[], b: number[]) { return a[0] <= b[1] && a[1] >= b[0] && a[2] <= b[3] && a[3] >= b[2]; }
