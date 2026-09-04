import React from 'react';
import { ChevronRight, Home, RefreshCw, FolderUp } from 'lucide-react';

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
  const parts = path.split('/').filter(Boolean);

  const handleParent = () => {
    if (!path || path === '/') return;
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    onNavigate(parentPath);
  };

  return (
    <div className="flex h-9 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] px-3 text-xs text-slate-300">
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => onNavigate(isRemote ? '.' : '/')}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
          title="Root directory"
        >
          <Home className="h-3.5 w-3.5 stroke-[1.5]" />
        </button>

        {parts.map((part, index) => {
          const currentSubPath = '/' + parts.slice(0, index + 1).join('/');
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

      <div className="flex items-center space-x-1 shrink-0 ml-2">
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
