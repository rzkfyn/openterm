import { describe, it, expect } from 'vitest';
import { calculateMenuPosition } from '../menuUtils';

describe('calculateMenuPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const menu = { width: 200, height: 300 };
  const reservedBottom = 24; // StatusBar height
  const margin = 8;

  it('renders at cursor when plenty of room below and right', () => {
    const pos = calculateMenuPosition({ x: 100, y: 100 }, menu, {
      viewport,
      reservedBottom,
      margin,
    });
    expect(pos).toEqual({ x: 100, y: 100 });
  });

  it('flips upward when cursor is near bottom', () => {
    // availableBottom is 800 - 24 - 8 = 768.
    // Anchor y: 700. 700 + 300 = 1000 > 768.
    // flippedY: 700 - 300 = 400.
    const pos = calculateMenuPosition({ x: 100, y: 700 }, menu, {
      viewport,
      reservedBottom,
      margin,
    });
    expect(pos).toEqual({ x: 100, y: 400 });
  });

  it('clamps above status bar when click is at extreme bottom', () => {
    // Anchor y: 780 (right over status bar)
    // 780 + 300 = 1080 > 768
    // flippedY: 780 - 300 = 480.
    const pos = calculateMenuPosition({ x: 100, y: 780 }, menu, {
      viewport,
      reservedBottom,
      margin,
    });
    expect(pos.y).toBe(468);
    expect(pos.y + menu.height).toBeLessThanOrEqual(viewport.height - reservedBottom - margin);
  });

  it('shifts left when cursor is near right edge', () => {
    // availableRight is 1000 - 8 = 992.
    // Anchor x: 950. 950 + 200 = 1150 > 992.
    // Clamped x = 992 - 200 = 792.
    const pos = calculateMenuPosition({ x: 950, y: 100 }, menu, {
      viewport,
      reservedBottom,
      margin,
    });
    expect(pos).toEqual({ x: 792, y: 100 });
  });

  it('clamps within viewport margins when click is negative or outside bounds', () => {
    const pos = calculateMenuPosition({ x: -20, y: -50 }, menu, {
      viewport,
      reservedBottom,
      margin,
    });
    expect(pos.x).toBe(8);
    expect(pos.y).toBe(8);
  });
});
