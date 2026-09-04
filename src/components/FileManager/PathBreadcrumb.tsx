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
    <div className="flex h-8 items-center justify-between border-b border-slate-800 bg-slate-900/40 px-2 text-xs text-slate-300">
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => onNavigate(isRemote ? '.' : '/')}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded"
          title="Root"
        >
          <Home className="h-3.5 w-3.5" />
        </button>

        {parts.map((part, index) => {
          const currentSubPath = '/' + parts.slice(0, index + 1).join('/');
          const isLast = index === parts.length - 1;

          return (
            <React.Fragment key={currentSubPath}>
              <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
              <button
                onClick={() => onNavigate(currentSubPath)}
                className={`truncate max-w-[120px] px-1 py-0.5 rounded text-left ${
                  isLast
                    ? 'font-medium text-sky-400 bg-slate-800/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
                title={part}
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center space-x-1 shrink-0 ml-1">
        <button
          onClick={handleParent}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
          title="Up one folder"
        >
          <FolderUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRefresh}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
