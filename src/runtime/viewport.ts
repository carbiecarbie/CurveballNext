export function stagePoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  if (rect.width <= 0 || rect.height <= 0) throw new Error('Empty viewport');
  return { x: (clientX - rect.left) * 350 / rect.width, y: (clientY - rect.top) * 250 / rect.height };
}
export function backingSize(width: number, height: number, dpr: number) { return { width: Math.round(width * dpr), height: Math.round(height * dpr) }; }
