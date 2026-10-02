import React, { useState, useCallback, useEffect } from 'react';

interface ResizableSplitterProps {
  direction?: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  direction = 'horizontal',
  onResize,
  onResizeEnd,
  className = '',
  onDoubleClick,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      onResize(direction === 'horizontal' ? e.movementX : e.movementY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (onResizeEnd) {
        onResizeEnd();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, onResize, onResizeEnd]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Drag to resize, double-click to reset (50/50)' : 'Drag to resize'}
      className={`relative z-20 shrink-0 select-none group flex items-center justify-center transition-colors ${
        direction === 'horizontal'
          ? 'w-[7px] cursor-col-resize hover:bg-indigo-500/50'
          : 'h-[7px] cursor-row-resize hover:bg-indigo-500/50'
      } ${isDragging ? 'bg-indigo-500' : 'bg-[#2a2b38]'} ${className}`}
    >
      {/* Invisible expanded hit area for easy grabbing */}
      <div
        className={`absolute inset-0 ${
          direction === 'horizontal' ? '-left-1 -right-1' : '-top-1 -bottom-1'
        }`}
      />
      {/* Visual grip handle affordance */}
      {direction === 'horizontal' ? (
        <div className="flex flex-col items-center justify-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
        </div>
      )}
    </div>
  );
};
