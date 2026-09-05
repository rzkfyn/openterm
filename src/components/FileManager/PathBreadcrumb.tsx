import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Home, RefreshCw, FolderUp, PenLine } from 'lucide-react';

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  isRemote?: boolean;
}

export const PathBreadcrumb: React.FC<PathBreadcrumbProps> = ({
  path,
  onNavigate,
  onRefresh,
  isRemote = false,
}) => {
  // Normalize separators for splitting (handle both / and \)
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setDraft(path);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== path) onNavigate(trimmed);
  };

  const handleParent = () => {
    if (!path || path === '/' || path === '\\') return;
    const norm = path.replace(/\\/g, '/');
    // Windows drive root like C:/ — nowhere to go
    if (/^[A-Za-z]:\/?$/.test(norm)) return;
    const parentPath = norm.substring(0, norm.lastIndexOf('/')) || '/';
    onNavigate(parentPath);
  };

  return (
    <div className="flex h-9 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] px-3 text-xs text-slate-300">
      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          spellCheck={false}
          className="flex-1 min-w-0 mr-2 px-2 py-1 rounded-md font-mono text-xs bg-white/[0.04] border border-emerald-500/30 text-slate-200 outline-none focus:border-emerald-500/60 placeholder:text-slate-600"
          placeholder={isRemote ? '/remote/path' : '/local/path'}
        />
      ) : (
        <div
          className="flex flex-1 min-w-0 items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 cursor-text"
          onClick={(e) => {
            if (e.target === e.currentTarget) startEditing();
          }}
          title="Click empty area to type a path"
        >
          <button
            onClick={() => onNavigate(isRemote ? '.' : '/')}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
            title="Root directory"
          >
            <Home className="h-3.5 w-3.5 stroke-[1.5]" />
          </button>

          {parts.map((part, index) => {
            // Build path: for Windows drive letters (e.g. "C:"), use "C:/"
            // otherwise use unix-style joining
            let currentSubPath: string;
            if (index === 0 && /^[A-Za-z]:$/.test(part)) {
              currentSubPath = part + '/';
            } else {
              const segments = parts.slice(0, index + 1);
              // Check if first segment is a drive letter
              if (/^[A-Za-z]:$/.test(segments[0])) {
                currentSubPath = segments[0] + '/' + segments.slice(1).join('/');
              } else {
                currentSubPath = '/' + segments.join('/');
              }
            }
            const isLast = index === parts.length - 1;

            return (
              <React.Fragment key={currentSubPath}>
                <ChevronRight className="h-3 w-3 text-slate-700 shrink-0" />
                <button
                  onClick={() => onNavigate(currentSubPath)}
                  className={`truncate max-w-[130px] px-2 py-0.5 rounded-md text-xs font-mono transition-all ${
                    isLast
                      ? 'font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                  title={part}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="flex items-center space-x-1 shrink-0 ml-2">
        {!isEditing && (
          <button
            onClick={startEditing}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
            title="Type a path"
          >
            <PenLine className="h-3.5 w-3.5 stroke-[1.5]" />
          </button>
        )}
        <button
          onClick={handleParent}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
          title="Parent folder"
        >
          <FolderUp className="h-3.5 w-3.5 stroke-[1.5]" />
        </button>
        <button
          onClick={onRefresh}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
          title="Refresh directory"
        >
          <RefreshCw className="h-3.5 w-3.5 stroke-[1.5]" />
        </button>
      </div>
    </div>
  );
};
