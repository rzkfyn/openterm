/**
 * Renders a VSCode-style filename pill as a PNG byte array
 * for use as a native drag preview image.
 */
export function renderDragLabel(filenames: string[]): number[] {
  const dpr = window.devicePixelRatio || 1;
  const fontSize = 12;
  const paddingX = 10;
  const paddingY = 6;
  const lineHeight = fontSize + 4;
  const maxLabels = 3;
  const cornerRadius = 6;

  const labels = filenames.length <= maxLabels
    ? filenames
    : [...filenames.slice(0, maxLabels - 1), `+${filenames.length - maxLabels + 1} more`];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize * dpr}px -apple-system, "Segoe UI", sans-serif`;

  // Measure text to determine canvas width
  let maxWidth = 0;
  for (const label of labels) {
    const m = ctx.measureText(label);
    if (m.width > maxWidth) maxWidth = m.width;
  }

  const w = Math.ceil(maxWidth + paddingX * 2 * dpr);
  const h = Math.ceil(labels.length * lineHeight * dpr + paddingY * 2 * dpr);
  canvas.width = w;
  canvas.height = h;

  // Re-set font after resize (canvas reset clears it)
  ctx.font = `${fontSize * dpr}px -apple-system, "Segoe UI", sans-serif`;

  // Background pill
  const r = cornerRadius * dpr;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30, 30, 45, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
  ctx.lineWidth = dpr;
  ctx.stroke();

  // Text
  ctx.fillStyle = '#e2e8f0';
  ctx.textBaseline = 'top';
  for (let i = 0; i < labels.length; i++) {
    ctx.fillText(labels[i], paddingX * dpr, paddingY * dpr + i * lineHeight * dpr);
  }

  // Export to PNG bytes
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Array<number>(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
