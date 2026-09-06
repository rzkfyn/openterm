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
    if (/^[A-Za-z]:\/?$/.test(norm)) return;
    const parentPath = norm.substring(0, norm.lastIndexOf('/')) || '/';
    onNavigate(parentPath);
  };

  return (
    <div className="flex h-[26px] items-center justify-between border-b border-[#2a2b38] bg-[#171724] px-2.5 text-xs text-slate-300 select-none">
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
          className="flex-1 min-w-0 mr-2 px-2 py-0.5 rounded bg-[#11111a] border border-indigo-500/70 text-slate-100 text-xs font-mono outline-none"
          placeholder={isRemote ? '/remote/path' : '/local/path'}
        />
      ) : (
        <div
          className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto py-0.5 cursor-text no-scrollbar"
          onClick={(e) => {
            if (e.target === e.currentTarget) startEditing();
          }}
          title="Click to enter path"
        >
          <button
            type="button"
            onClick={() => onNavigate(isRemote ? '.' : '/')}
            className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-[#252538] cursor-pointer transition-colors"
            title="Root directory"
          >
            <Home className="h-3 w-3" />
          </button>

          {parts.map((part, index) => {
            let currentSubPath: string;
            if (index === 0 && /^[A-Za-z]:$/.test(part)) {
              currentSubPath = part + '/';
            } else {
              const segments = parts.slice(0, index + 1);
              if (/^[A-Za-z]:$/.test(segments[0])) {
                currentSubPath = segments[0] + '/' + segments.slice(1).join('/');
              } else {
                currentSubPath = '/' + segments.join('/');
              }
            }
            const isLast = index === parts.length - 1;

            return (
              <React.Fragment key={currentSubPath}>
                <ChevronRight className="h-2.5 w-2.5 text-slate-600 shrink-0" />
                <button
                  type="button"
                  onClick={() => onNavigate(currentSubPath)}
                  className={`truncate max-w-[130px] px-1.5 py-0.5 rounded text-[11px] font-sans cursor-pointer transition-colors ${
                    isLast
                      ? 'text-indigo-300 font-medium bg-indigo-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#252538]'
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

      <div className="flex items-center gap-0.5 shrink-0 ml-1.5">
        {!isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#252538] rounded cursor-pointer transition-colors"
            title="Edit path text"
          >
            <PenLine className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleParent}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#252538] rounded cursor-pointer transition-colors"
          title="Parent folder"
        >
          <FolderUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#252538] rounded cursor-pointer transition-colors"
          title="Refresh directory"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
