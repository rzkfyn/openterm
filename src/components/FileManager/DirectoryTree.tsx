import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, Loader2 } from 'lucide-react';
import { tauriApi } from '../../services/tauri';

interface TreeNode {
  path: string;
  name: string;
  isExpanded: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  children: TreeNode[];
}

interface DirectoryTreeProps {
  currentPath: string;
  isRemote: boolean;
  sessionId?: string | null;
  onSelectFolder: (path: string) => void;
}

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  currentPath,
  isRemote,
  sessionId,
  onSelectFolder,
}) => {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>(currentPath);

  useEffect(() => {
    setSelectedPath(currentPath);
  }, [currentPath]);

  // Determine root path based on platform and currentPath
  const getInitialRootPath = useCallback(() => {
    if (isRemote) return '/';
    if (!currentPath) return '/';
    const winDrive = currentPath.match(/^[A-Za-z]:[\\/]/);
    if (winDrive) {
      return winDrive[0].toUpperCase();
    }
    return '/';
  }, [currentPath, isRemote]);

  // Fetch subdirectories for a given folder path
  const fetchSubdirs = useCallback(
    async (dirPath: string): Promise<TreeNode[]> => {
      try {
        if (isRemote) {
          if (!sessionId) return [];
          const res = await tauriApi.sftpListDir(sessionId, dirPath, 0, 300);
          return res.entries
            .filter((e) => e.isDir)
            .map((e) => ({
              path: e.path,
              name: e.name,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
            }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        } else {
          const res = await tauriApi.localListDir(dirPath, 0, 300);
          return res.entries
            .filter((e) => e.isDir)
            .map((e) => ({
              path: e.path,
              name: e.name,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
            }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        }
      } catch (err) {
        console.error('Failed to load subdirectories for tree:', dirPath, err);
        return [];
      }
    },
    [isRemote, sessionId]
  );

  // Initialize tree
  useEffect(() => {
    let isCancelled = false;

    const initRoot = async () => {
      const rootPath = getInitialRootPath();
      const rootNode: TreeNode = {
        path: rootPath,
        name: isRemote ? '/' : rootPath,
        isExpanded: true,
        isLoading: true,
        isLoaded: false,
        children: [],
      };

      setRootNodes([rootNode]);

      const subdirs = await fetchSubdirs(rootPath);
      if (!isCancelled) {
        setRootNodes([
          {
            ...rootNode,
            isLoading: false,
            isLoaded: true,
            children: subdirs,
          },
        ]);
      }
    };

    initRoot();

    return () => {
      isCancelled = true;
    };
  }, [getInitialRootPath, fetchSubdirs]);

  // Toggle node expansion
  const toggleNode = async (targetNode: TreeNode) => {
    const updateTree = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.path === targetNode.path) {
          const nextExpanded = !node.isExpanded;
          return {
            ...node,
            isExpanded: nextExpanded,
            isLoading: nextExpanded && !node.isLoaded,
          };
        }
        if (node.children.length > 0) {
          return {
            ...node,
            children: updateTree(node.children),
          };
        }
        return node;
      });
    };

    setRootNodes((prev) => updateTree(prev));

    if (!targetNode.isLoaded && !targetNode.isExpanded) {
      const children = await fetchSubdirs(targetNode.path);
      setRootNodes((prev) => {
        const attachChildren = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((node) => {
            if (node.path === targetNode.path) {
              return {
                ...node,
                isLoading: false,
                isLoaded: true,
                isExpanded: true,
                children,
              };
            }
            if (node.children.length > 0) {
              return {
                ...node,
                children: attachChildren(node.children),
              };
            }
            return node;
          });
        };
        return attachChildren(prev);
      });
    }
  };

  const handleSelect = (node: TreeNode) => {
    setSelectedPath(node.path);
    onSelectFolder(node.path);
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isSelected =
      selectedPath === node.path ||
      selectedPath.replace(/[\\/]$/, '') === node.path.replace(/[\\/]$/, '');

    return (
      <div key={node.path} className="flex flex-col">
        <div
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`flex items-center gap-1 py-1 pr-2 rounded text-xs cursor-pointer select-none transition-colors ${
            isSelected
              ? 'bg-indigo-600/30 text-indigo-200 font-medium'
              : 'text-slate-300 hover:bg-[#252538] hover:text-white'
          }`}
          onClick={() => handleSelect(node)}
        >
          {/* Expand/Collapse Chevron */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleNode(node);
            }}
            className="p-0.5 rounded hover:bg-slate-700/40 text-slate-400 hover:text-white shrink-0 cursor-pointer"
          >
            {node.isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
            ) : node.isExpanded ? (
              <ChevronDown className="h-3 w-3 text-slate-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-slate-400" />
            )}
          </button>

          {/* Folder Icon */}
          {node.isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
          )}

          {/* Folder Name */}
          <span className="truncate text-[11px] font-mono leading-none">{node.name}</span>
        </div>

        {/* Children */}
        {node.isExpanded && node.children.length > 0 && (
          <div className="flex flex-col">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#151522] border-b border-[#2a2b38] overflow-hidden select-none">
      <div className="flex h-[24px] items-center justify-between px-2.5 bg-[#101018] border-b border-[#2a2b38] text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">
        <span>Directory Tree</span>
        <button
          type="button"
          onClick={() => {
            const root = getInitialRootPath();
            fetchSubdirs(root).then((children) => {
              setRootNodes([
                {
                  path: root,
                  name: isRemote ? '/' : root,
                  isExpanded: true,
                  isLoading: false,
                  isLoaded: true,
                  children,
                },
              ]);
            });
          }}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer"
          title="Refresh Directory Tree"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-0.5">
        {rootNodes.map((root) => renderNode(root, 0))}
      </div>
    </div>
  );
};
