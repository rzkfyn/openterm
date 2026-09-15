import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { ISearchOptions } from '@xterm/addon-search';

interface TerminalSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  onFindNext: (term: string, options: ISearchOptions) => boolean;
  onFindPrevious: (term: string, options: ISearchOptions) => boolean;
  onClear: () => void;
  resultInfo: { resultIndex: number; resultCount: number } | null;
  initialQuery?: string;
}

export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({
  isOpen,
  onClose,
  onFindNext,
  onFindPrevious,
  onClear,
  resultInfo,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and set initial query when opened
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
      }
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      onClear();
    }
  }, [isOpen, initialQuery]);

  const searchOptions: ISearchOptions = {
    caseSensitive,
    wholeWord,
    regex,
    incremental: true,
    decorations: {
      matchBackground: '#3e4451',
      activeMatchBackground: '#f59e0b',
      matchOverviewRuler: '#818cf8',
      activeMatchColorOverviewRuler: '#f59e0b',
    },
  };

  // Live search when query or search options change
  useEffect(() => {
    if (!isOpen) return;
    if (query.trim()) {
      onFindNext(query, searchOptions);
    } else {
      onClear();
    }
  }, [query, caseSensitive, wholeWord, regex, isOpen]);

  const handleNext = () => {
    if (!query) return;
    onFindNext(query, { ...searchOptions, incremental: false });
  };

  const handlePrev = () => {
    if (!query) return;
    onFindPrevious(query, { ...searchOptions, incremental: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-2 right-4 z-40 flex items-center gap-1.5 rounded-lg bg-[#181824]/95 backdrop-blur-md border border-[#2a2b38] px-2.5 py-1.5 shadow-2xl text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="absolute left-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in terminal..."
          className="w-48 sm:w-60 rounded bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 pl-7 pr-16 py-1 text-xs text-white placeholder-slate-500 outline-none font-mono"
        />

        {/* Result match counter badge */}
        {query && (
          <span className="absolute right-2 text-[10.5px] font-mono text-slate-400 pointer-events-none">
            {resultInfo && resultInfo.resultCount > 0
              ? `${resultInfo.resultIndex + 1}/${resultInfo.resultCount}`
              : '0/0'}
          </span>
        )}
      </div>

      {/* Prev / Next navigation buttons */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!query}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Previous Match (Shift+Enter)"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!query}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Next Match (Enter)"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-3.5 w-px bg-[#2a2b38] mx-0.5" />

      {/* Option Toggles: Match Case, Match Whole Word, Regex */}
      <div className="flex items-center gap-0.5 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => setCaseSensitive(!caseSensitive)}
          className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
            caseSensitive
              ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-[#252538]'
          }`}
          title="Match Case (Aa)"
        >
          Aa
        </button>
        <button
          type="button"
          onClick={() => setWholeWord(!wholeWord)}
          className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
            wholeWord
              ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-[#252538]'
          }`}
          title="Match Whole Word (\b)"
        >
          \b
        </button>
        <button
          type="button"
          onClick={() => setRegex(!regex)}
          className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
            regex
              ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-[#252538]'
          }`}
          title="Use Regular Expression (.*)"
        >
          .*
        </button>
      </div>

      <div className="h-3.5 w-px bg-[#2a2b38] mx-0.5" />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer"
        title="Close Search (Escape)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
