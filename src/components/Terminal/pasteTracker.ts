let lastPastedText = '';
let lastPastedTime = 0;

export function shouldProcessPaste(text: string, now: number = Date.now()): boolean {
  if (!text) return false;
  if (text === lastPastedText && now - lastPastedTime < 150) {
    return false;
  }
  lastPastedText = text;
  lastPastedTime = now;
  return true;
}

export function resetPasteTracker(): void {
  lastPastedText = '';
  lastPastedTime = 0;
}
