import { Terminal } from '@xterm/xterm';

export interface SelectionPosition {
  col: number;
  row: number;
}

export interface SelectionRange {
  startCol: number;
  startRow: number;
  length: number;
}

export interface KeyboardSelectionState {
  anchor: SelectionPosition;
  active: SelectionPosition;
}

export function calculateNewPosition(
  current: SelectionPosition,
  key: string,
  cols: number
): SelectionPosition {
  let { col, row } = current;

  switch (key) {
    case 'ArrowRight':
      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
      break;
    case 'ArrowLeft':
      if (col > 0) {
        col--;
      } else if (row > 0) {
        col = cols - 1;
        row--;
      }
      break;
    case 'ArrowUp':
      if (row > 0) {
        row--;
      }
      break;
    case 'ArrowDown':
      row++;
      break;
    default:
      break;
  }

  return { col, row };
}

export function calculateSelectionRange(
  anchor: SelectionPosition,
  active: SelectionPosition,
  cols: number
): SelectionRange | null {
  const anchorIndex = anchor.row * cols + anchor.col;
  const activeIndex = active.row * cols + active.col;

  if (anchorIndex === activeIndex) {
    return null;
  }

  const startIndex = Math.min(anchorIndex, activeIndex);
  const endIndex = Math.max(anchorIndex, activeIndex);
  const length = endIndex - startIndex;

  return {
    startCol: startIndex % cols,
    startRow: Math.floor(startIndex / cols),
    length,
  };
}

export function applyShiftArrowSelection(
  term: Terminal,
  key: string,
  stateRef: { current: KeyboardSelectionState | null }
): void {
  const cols = term.cols;
  const buffer = term.buffer.active;

  if (!stateRef.current) {
    // If xterm already has a mouse selection, anchor to its start
    const existingRange = term.getSelectionPosition();
    if (existingRange) {
      stateRef.current = {
        anchor: { col: existingRange.start.x, row: existingRange.start.y },
        active: { col: existingRange.end.x, row: existingRange.end.y },
      };
    } else {
      // Anchor to current cursor position in absolute buffer coordinates
      const cursorCol = buffer.cursorX;
      const cursorRow = buffer.baseY + buffer.cursorY;
      stateRef.current = {
        anchor: { col: cursorCol, row: cursorRow },
        active: { col: cursorCol, row: cursorRow },
      };
    }
  }

  const newActive = calculateNewPosition(stateRef.current.active, key, cols);
  stateRef.current.active = newActive;

  const range = calculateSelectionRange(stateRef.current.anchor, newActive, cols);
  if (range && range.length > 0) {
    term.select(range.startCol, range.startRow, range.length);
  } else {
    term.clearSelection();
  }
}

export function clearKeyboardSelection(
  term: Terminal,
  stateRef: { current: KeyboardSelectionState | null }
): void {
  if (stateRef.current) {
    stateRef.current = null;
    term.clearSelection();
  }
}
