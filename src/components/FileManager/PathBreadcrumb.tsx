import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FolderUp,
  RefreshCw,
  Copy,
  Check,
  Home,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  isRemote?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
}

export const PathBreadcrumb: React.FC<PathBreadcrumbProps> = ({
  path,
  onNavigate,
  onRefresh,
  isRemote = false,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
}) => {
  const [draft, setDraft] = useState(path);
  const [isFocused, setIsFocused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(path);
    }
  }, [path, isFocused]);

  const commit = () => {
    setIsFocused(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== path) {
      onNavigate(trimmed);
    } else {
      setDraft(path);
    }
  };

  const handleCopy = async () => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleParent = () => {
    if (!path || path === '/' || path === '\\') return;
    const norm = path.replace(/\\/g, '/');
    if (/^[A-Za-z]:\/?$/.test(norm)) return;
    const parentPath = norm.substring(0, norm.lastIndexOf('/')) || '/';
    onNavigate(parentPath);
  };

  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  return (
    <div
      onKeyDown={(e) => {
        if (!isFocused) {
          if (((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) || (e.altKey && (e.key === 'd' || e.key === 'D'))) {
            e.preventDefault();
            setShowBreadcrumbs(false);
            inputRef.current?.focus();
            inputRef.current?.select();
          } else if (e.altKey && e.key === 'ArrowUp') {
            e.preventDefault();
            handleParent();
          } else if (e.altKey && e.key === 'ArrowLeft' && canGoBack) {
            e.preventDefault();
            onGoBack?.();
          } else if (e.altKey && e.key === 'ArrowRight' && canGoForward) {
            e.preventDefault();
            onGoForward?.();
          }
        }
      }}
      className="flex h-[28px] items-center gap-1 border-b border-[#2a2b38] bg-[#171724] px-2 text-xs text-slate-300 select-none shrink-0"
    >
      {/* Navigation History Controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={onGoBack}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          title="Back (Alt+Left or Mouse 4)"
        >
          <ArrowLeft className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={onGoForward}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          title="Forward (Alt+Right or Mouse 5)"
        >
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleParent}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] transition-colors"
          title="Up one directory level (Alt+Up)"
        >
          <FolderUp className="h-3 w-3" />
        </button>
      </div>

      {/* Path Display: Raw Path (Default) or Breadcrumb */}
      <div className="flex flex-1 min-w-0 items-center mx-1 relative">
        {showBreadcrumbs ? (
          <div
            className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto py-0.5 cursor-pointer no-scrollbar"
            onClick={() => {
              setShowBreadcrumbs(false);
              setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
              }, 50);
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(isRemote ? '.' : '/');
              }}
              className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-[#252538] transition-colors"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(currentSubPath);
                    }}
                    className={`truncate max-w-[140px] px-1.5 py-0.5 rounded text-[11px] font-sans transition-colors ${
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
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              inputRef.current?.select();
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(path);
                setIsFocused(false);
                inputRef.current?.blur();
              }
            }}
            spellCheck={false}
            className="w-full bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 px-2 py-0.5 rounded text-[11px] font-mono text-slate-200 outline-none transition-colors"
            placeholder={isRemote ? '/remote/path' : 'C:\\local\\path'}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer"
          title="Copy path to clipboard"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>

        <button
          type="button"
          onClick={() => setShowBreadcrumbs(!showBreadcrumbs)}
          className={`p-1 rounded transition-colors cursor-pointer ${
            showBreadcrumbs ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-[#252538]'
          }`}
          title={showBreadcrumbs ? 'Switch to raw path' : 'Switch to breadcrumb segments'}
        >
          <SlidersHorizontal className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer"
          title="Refresh directory (F5)"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
