import React, { useEffect } from 'react';
import { Sparkles, RefreshCw, X, ExternalLink, Download } from 'lucide-react';
import { useUpdateStore } from '../../stores/updateStore';
import {
  calculateVersionDistance,
  parseSemver,
  isNewerVersion,
} from '../../services/updateChecker';
import { MarkdownRenderer } from '../Common/MarkdownRenderer';
import { tauriApi } from '../../services/tauri';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

function isCurrentRelease(tagName: string, currentVersion: string): boolean {
  const r = parseSemver(tagName);
  const c = parseSemver(currentVersion);
  if (r && c) {
    return r[0] === c[0] && r[1] === c[1] && r[2] === c[2];
  }
  return tagName.trim().replace(/^v/i, '') === currentVersion.trim().replace(/^v/i, '');
}

export const ChangelogModal: React.FC = () => {
  const {
    isChangelogOpen,
    closeChangelog,
    releases,
    isLoadingReleases,
    selectedReleaseTag,
    selectRelease,
    fetchReleases,
    currentVersion,
  } = useUpdateStore();

  useEffect(() => {
    if (!isChangelogOpen || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeChangelog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChangelogOpen, closeChangelog]);

  if (!isChangelogOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeChangelog();
    }
  };

  const handleOpenReleaseUrl = (url: string) => {
    if (!url) return;
    try {
      const p = tauriApi.openUrl(url);
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (typeof window !== 'undefined' && window.open) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      }
    } catch {
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Determine selected release
  const selectedRelease = selectedReleaseTag
    ? releases.find((r) => r.tagName === selectedReleaseTag) || null
    : null;

  // Version distance calculation
  const cleanCurrent = currentVersion.trim().replace(/^v/i, '');
  let badgeText = `v${cleanCurrent} · Current`;
  let badgeClass = 'bg-white/5 border-white/10 text-gray-400';

  if (!isLoadingReleases && releases.length > 0) {
    const distance = calculateVersionDistance(releases, currentVersion);
    if (distance.isLatest) {
      badgeText = `v${cleanCurrent} · Up to date ✓`;
      badgeClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    } else {
      const unit = distance.behindCount === 1 ? 'version' : 'versions';
      badgeText = `v${cleanCurrent} · ${distance.behindCount} ${unit} behind latest v${distance.latestVersion}`;
      badgeClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-4xl h-[80vh] max-h-[85vh] bg-[#11111a] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200"
        role="dialog"
        aria-modal="true"
        aria-label="Changelog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141420]">
          {/* Left: Icon, Title, Subtitle */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Changelog</h2>
              <p className="text-xs text-gray-400">Browse what's new in each release</p>
            </div>
          </div>

          {/* Center: Version Distance Badge */}
          <div className={`px-2.5 py-1 text-xs font-medium rounded-full border flex items-center gap-1.5 ${badgeClass}`}>
            <span>{badgeText}</span>
          </div>

          {/* Right: Check for Updates & Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchReleases(true)}
              disabled={isLoadingReleases}
              aria-label="Check for updates"
              title="Check for updates"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoadingReleases ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Check for updates</span>
            </button>
            <button
              type="button"
              onClick={closeChangelog}
              aria-label="Close changelog"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Split Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-64 sm:w-72 border-r border-white/10 flex flex-col bg-white/[0.01]">
            {isLoadingReleases && releases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-400 gap-2 text-sm">
                <RefreshCw size={20} className="animate-spin text-indigo-400" />
                <span>Loading releases...</span>
              </div>
            ) : releases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-400 text-sm text-center">
                <span>No releases found</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {releases.map((item, index) => {
                  const isSelected = item.tagName === selectedReleaseTag;
                  const isCurrent = isCurrentRelease(item.tagName, currentVersion);
                  const isLatest = index === 0;
                  const isNew = isNewerVersion(item.tagName, currentVersion) && !isCurrent;

                  return (
                    <button
                      type="button"
                      key={item.id || item.tagName}
                      data-tag={item.tagName}
                      onClick={() => selectRelease(item.tagName)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-white/10 border-indigo-500/40 text-white shadow-sm'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5 font-medium text-sm">
                          {isNew && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          )}
                          <span className={isSelected ? 'text-white' : 'text-gray-200'}>
                            {item.tagName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {isLatest && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                              Latest
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                              Current
                            </span>
                          )}
                          {isNew && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                              New
                            </span>
                          )}
                        </div>
                      </div>

                      {item.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {formatDate(item.publishedAt)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Content Pane */}
          <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
            {!selectedRelease ? (
              <div className="flex-1 flex items-center justify-center p-6 text-gray-400 text-sm">
                Select a release to view notes.
              </div>
            ) : (
              <>
                {/* Selected Release Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141420]/50">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-semibold text-white">
                      {selectedRelease.name || selectedRelease.tagName}
                    </h3>
                    {selectedRelease.publishedAt && (
                      <p className="text-xs text-gray-400">
                        Released on {formatDate(selectedRelease.publishedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-action="download"
                      onClick={() => handleOpenReleaseUrl(selectedRelease.htmlUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
                    >
                      <Download size={13} />
                      <span>Download Update</span>
                    </button>
                    <button
                      type="button"
                      data-action="github"
                      onClick={() => handleOpenReleaseUrl(selectedRelease.htmlUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>View on GitHub</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Release Notes */}
                <div className="flex-1 overflow-y-auto p-6">
                  {selectedRelease.body && selectedRelease.body.trim().length > 0 ? (
                    <MarkdownRenderer content={selectedRelease.body} />
                  ) : (
                    <div className="text-gray-400 text-sm">
                      No release notes provided for this version.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
