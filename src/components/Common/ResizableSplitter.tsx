import React, { useState, useCallback, useEffect } from 'react';

interface ResizableSplitterProps {
  direction?: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  className?: string;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  direction = 'horizontal',
  onResize,
  onResizeEnd,
  className = '',
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
      className={`relative z-20 shrink-0 select-none group transition-colors ${
        direction === 'horizontal'
          ? 'w-[5px] cursor-col-resize hover:bg-indigo-500/50'
          : 'h-[5px] cursor-row-resize hover:bg-indigo-500/50'
      } ${isDragging ? 'bg-indigo-500' : 'bg-[#2a2b38]'} ${className}`}
    >
      {/* Invisible expanded hit area for easy grabbing */}
      <div
        className={`absolute inset-0 ${
          direction === 'horizontal' ? '-left-1 -right-1' : '-top-1 -bottom-1'
        }`}
      />
    </div>
  );
};
