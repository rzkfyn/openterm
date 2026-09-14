import { describe, it, expect } from 'vitest';
import {
  calculateSelectionRange,
  calculateNewPosition,
  SelectionPosition,
} from '../terminalSelection';

describe('Terminal keyboard selection', () => {
  const cols = 80;

  describe('calculateNewPosition', () => {
    it('moves right with ArrowRight', () => {
      const pos: SelectionPosition = { col: 10, row: 5 };
      expect(calculateNewPosition(pos, 'ArrowRight', cols)).toEqual({ col: 11, row: 5 });
    });

    it('wraps to next line when moving right at line end', () => {
      const pos: SelectionPosition = { col: 79, row: 5 };
      expect(calculateNewPosition(pos, 'ArrowRight', cols)).toEqual({ col: 0, row: 6 });
    });

    it('moves left with ArrowLeft', () => {
      const pos: SelectionPosition = { col: 10, row: 5 };
      expect(calculateNewPosition(pos, 'ArrowLeft', cols)).toEqual({ col: 9, row: 5 });
    });

    it('wraps to previous line when moving left at column 0', () => {
      const pos: SelectionPosition = { col: 0, row: 5 };
      expect(calculateNewPosition(pos, 'ArrowLeft', cols)).toEqual({ col: 79, row: 4 });
    });

    it('does not go negative row when moving left at 0, 0', () => {
      const pos: SelectionPosition = { col: 0, row: 0 };
      expect(calculateNewPosition(pos, 'ArrowLeft', cols)).toEqual({ col: 0, row: 0 });
    });

    it('moves up with ArrowUp', () => {
      const pos: SelectionPosition = { col: 10, row: 5 };
      expect(calculateNewPosition(pos, 'ArrowUp', cols)).toEqual({ col: 10, row: 4 });
    });

    it('does not move past row 0 with ArrowUp', () => {
      const pos: SelectionPosition = { col: 10, row: 0 };
      expect(calculateNewPosition(pos, 'ArrowUp', cols)).toEqual({ col: 10, row: 0 });
    });

    it('moves down with ArrowDown', () => {
      const pos: SelectionPosition = { col: 10, row: 5 };
      expect(calculateNewPosition(pos, 'ArrowDown', cols)).toEqual({ col: 10, row: 6 });
    });
  });

  describe('calculateSelectionRange', () => {
    it('returns null if anchor and active positions are identical', () => {
      const pos: SelectionPosition = { col: 10, row: 5 };
      expect(calculateSelectionRange(pos, pos, cols)).toBeNull();
    });

    it('returns forward selection on same line', () => {
      const anchor: SelectionPosition = { col: 10, row: 5 };
      const active: SelectionPosition = { col: 15, row: 5 };
      expect(calculateSelectionRange(anchor, active, cols)).toEqual({
        startCol: 10,
        startRow: 5,
        length: 5,
      });
    });

    it('returns backward selection on same line correctly normalized', () => {
      const anchor: SelectionPosition = { col: 15, row: 5 };
      const active: SelectionPosition = { col: 10, row: 5 };
      expect(calculateSelectionRange(anchor, active, cols)).toEqual({
        startCol: 10,
        startRow: 5,
        length: 5,
      });
    });

    it('returns multi-line selection spanning across rows', () => {
      const anchor: SelectionPosition = { col: 10, row: 5 };
      const active: SelectionPosition = { col: 10, row: 6 };
      // From (5*80 + 10 = 410) to (6*80 + 10 = 490) -> length 80
      expect(calculateSelectionRange(anchor, active, cols)).toEqual({
        startCol: 10,
        startRow: 5,
        length: 80,
      });
    });
  });
});
