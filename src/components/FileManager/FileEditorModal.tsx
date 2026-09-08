import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { tauriApi } from '../../services/tauri';

interface FileEditorModalProps {
  isOpen: boolean;
  filePath: string;
  isRemote: boolean;
  sessionId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  isOpen,
  filePath,
  isRemote,
  sessionId,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== originalContent;
  const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';

  useEffect(() => {
    if (!isOpen || !filePath) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadContent = async () => {
      try {
        if (isRemote) {
          if (!sessionId) throw new Error('No active SSH session');
          const text = await tauriApi.sftpReadTextFile(sessionId, filePath);
          if (isMounted) {
            setContent(text);
            setOriginalContent(text);
          }
        } else {
          // For local files, read via fetch or local read (we can add local file read if needed)
          setContent('Local file preview');
          setOriginalContent('Local file preview');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(typeof err === 'string' ? err : err.message || 'Failed to load file content');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [isOpen, filePath, isRemote, sessionId]);

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      if (isRemote) {
        if (!sessionId) throw new Error('No active SSH session');
        await tauriApi.sftpWriteTextFile(sessionId, filePath, content);
      }
      setOriginalContent(content);
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }

    // Handle Tab key insertion
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + '  ' + val.substring(end);
      setContent(updated);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  if (!isOpen) return null;

  const lines = content.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div className="flex flex-col w-full max-w-4xl h-[85vh] rounded-lg bg-[#15151e] border border-[#2e2f42] shadow-2xl overflow-hidden text-slate-200">
        {/* Editor Top Bar */}
        <div className="flex items-center justify-between h-10 px-4 bg-[#11111a] border-b border-[#2a2b38] select-none">
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs font-semibold text-slate-200">
              {fileName}
              {isDirty && <span className="text-amber-400 font-bold ml-1">*</span>}
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-md">({filePath})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving || isLoading}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
              title="Save (Ctrl+S)"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDirty) {
                  if (confirm('You have unsaved changes. Discard and close?')) {
                    onClose();
                  }
                } else {
                  onClose();
                }
              }}
              className="rounded p-1 text-slate-400 hover:text-white hover:bg-[#252636] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-950/60 border-b border-rose-800 text-rose-300 text-xs font-mono">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Editor Main Canvas */}
        <div className="flex flex-1 overflow-hidden relative font-mono text-xs leading-5">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Loading file contents...</span>
            </div>
          ) : (
            <div className="flex w-full h-full">
              {/* Line numbers column */}
              <div className="w-12 py-3 bg-[#11111a] border-r border-[#222332] select-none text-right pr-2 text-slate-600 overflow-hidden font-mono shrink-0">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea code editor */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="flex-1 h-full w-full p-3 bg-[#171724] text-slate-100 resize-none outline-hidden border-none font-mono focus:ring-0 whitespace-pre overflow-auto tab-4"
              />
            </div>
          )}
        </div>

        {/* Editor Status Bar */}
        <div className="flex items-center justify-between h-6 px-3 bg-[#11111a] border-t border-[#222332] text-[10px] text-slate-500 font-mono select-none">
          <div>
            {lines.length} lines | {content.length} characters
          </div>
          <div>UTF-8 | LF</div>
        </div>
      </div>
    </div>
  );
};
