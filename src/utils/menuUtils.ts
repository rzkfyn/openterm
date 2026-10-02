export interface MenuPosition {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface MenuBoundaryOptions {
  viewport?: Dimensions;
  reservedBottom?: number;
  margin?: number;
}

/**
 * Calculates clamped and viewport-aware coordinates for context menus.
 * Automatically flips upward if there is insufficient vertical space,
 * and preserves clearance for the bottom StatusBar (default 24px) + margin.
 */
export function calculateMenuPosition(
  anchor: MenuPosition,
  menu: Dimensions,
  options: MenuBoundaryOptions = {}
): MenuPosition {
  const margin = options.margin ?? 8;
  const reservedBottom = options.reservedBottom ?? 24;
  const viewport = options.viewport ?? {
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  };

  const availableBottom = Math.max(margin, viewport.height - reservedBottom - margin);
  const availableRight = Math.max(margin, viewport.width - margin);

  // Vertical positioning: flip upward if overflows bottom
  let y = anchor.y;
  if (anchor.y + menu.height > availableBottom) {
    const flippedY = anchor.y - menu.height;
    // Ensure both top and bottom edges stay within available vertical space
    y = Math.max(margin, Math.min(flippedY, availableBottom - menu.height));
  } else {
    y = Math.max(margin, anchor.y);
  }

  // Horizontal positioning: shift left if overflows right
  let x = anchor.x;
  if (anchor.x + menu.width > availableRight) {
    x = Math.max(margin, availableRight - menu.width);
  } else {
    x = Math.max(margin, anchor.x);
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}
