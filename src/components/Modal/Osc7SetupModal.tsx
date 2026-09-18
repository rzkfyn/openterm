import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, X, ExternalLink } from 'lucide-react';
import { tauriApi } from '../../services/tauri';

const OSC7_SPECS_URL = 'https://iterm2.com/documentation-escape-codes.html';
export type ShellType = 'bash' | 'zsh' | 'fish';

export interface ShellConfig {
  name: string;
  configPath: string;
  instruction: string;
  snippet: string;
}

export const SHELL_CONFIGS: Record<ShellType, ShellConfig> = {
  bash: {
    name: 'Bash',
    configPath: '~/.bashrc',
    instruction: 'Add to ~/.bashrc on the remote server, then run source ~/.bashrc.',
    snippet: `osc7_cwd() {
  printf "\\033]7;file://%s%s\\033\\\\" "$HOSTNAME" "$PWD"
}
PROMPT_COMMAND="osc7_cwd; $PROMPT_COMMAND"`,
  },
  zsh: {
    name: 'Zsh',
    configPath: '~/.zshrc',
    instruction: 'Add to ~/.zshrc on the remote server, then run source ~/.zshrc.',
    snippet: `chpwd_osc7() {
  print -n "\\e]7;file://\${HOST}\${PWD}\\a"
}
autoload -Uz add-zsh-hook
add-zsh-hook chpwd chpwd_osc7`,
  },
  fish: {
    name: 'Fish',
    configPath: '~/.config/fish/config.fish',
    instruction: 'Add to ~/.config/fish/config.fish on the remote server.',
    snippet: `function emit_osc7 --on-variable PWD
  printf \'\\e]7;file://%s%s\\e\\\\\' (hostname) $PWD
end`,
  },
};

export interface Osc7SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: ShellType;
}

const SHELL_TABS: ShellType[] = ['bash', 'zsh', 'fish'];

export const Osc7SetupModal: React.FC<Osc7SetupModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'bash',
}) => {
  const [activeTab, setActiveTab] = useState<ShellType>(defaultTab);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
    setCopied(false);
  }, [isOpen, defaultTab]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleTabChange = (tab: ShellType) => {
    setActiveTab(tab);
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SHELL_CONFIGS[activeTab].snippet);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        className="flex flex-col w-full max-w-lg rounded-xl bg-[#181824] border border-[#2a2b38] shadow-2xl text-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="osc7-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2b38] bg-[#141420]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e1e2d] border border-[#2a2b38] text-indigo-400 shrink-0">
              <Terminal className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 id="osc7-modal-title" className="text-sm font-semibold text-white tracking-tight">
                Remote Shell OSC 7 Setup
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Description */}
          <p className="text-xs text-slate-300 leading-relaxed">
            SSH connections require remote shells to emit OSC 7 escape sequences to notify OpenTerm of directory changes. Add the configuration snippet below to your remote shell profile.
          </p>

          {/* Shell Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#11111a] border border-[#2a2b38]">
            {SHELL_TABS.map((tabKey) => {
              const tab = SHELL_CONFIGS[tabKey];
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => handleTabChange(tabKey)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors text-center cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#181824] border border-transparent'
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Shell Content Block */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              {SHELL_CONFIGS[activeTab].instruction}
            </p>
            <pre className="p-3.5 rounded-lg bg-[#11111a] border border-[#2a2b38] font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed select-text">
              <code>{SHELL_CONFIGS[activeTab].snippet}</code>
            </pre>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                tauriApi.openUrl(OSC7_SPECS_URL).catch(() => {
                  window.open(OSC7_SPECS_URL, '_blank', 'noopener,noreferrer');
                });
              }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <span>OSC 7 Specs</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
