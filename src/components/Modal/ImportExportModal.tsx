import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileCode,
  Check,
  AlertTriangle,
  Folder,
  Bookmark,
  Server,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-react';
import { SavedConnection } from '../../types';
import { parseFileZillaXml } from '../../services/filezillaParser';
import { exportToOpenTermJson, exportToFileZillaXml } from '../../services/connectionExporter';

interface ImportItem extends Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'> {
  tempId: string;
  selected: boolean;
  isDuplicate: boolean;
  existingId?: string;
}

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingConnections: SavedConnection[];
  onImportComplete: (imported: SavedConnection[]) => void;
  onSaveConnection: (conn: SavedConnection) => Promise<SavedConnection>;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  existingConnections,
  onImportComplete,
  onSaveConnection,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [exportFormat, setExportFormat] = useState<'json' | 'xml'>('json');
  const [parsedItems, setParsedItems] = useState<ImportItem[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<'rename' | 'overwrite'>('rename');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    try {
      const text = await file.text();
      let imported: Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'>[] = [];

      if (file.name.endsWith('.xml') || text.trim().startsWith('<?xml') || text.includes('<FileZilla3')) {
        imported = parseFileZillaXml(text);
      } else {
        // Attempt JSON parse
        const json = JSON.parse(text);
        imported = Array.isArray(json) ? json : [json];
      }

      if (imported.length === 0) {
        alert('No valid connection profiles found in file.');
        return;
      }

      const items: ImportItem[] = imported.map((item) => {
        const existing = existingConnections.find(
          (e) => e.host === item.host && e.port === item.port && e.username === item.username
        );
        return {
          ...item,
          tempId: Math.random().toString(36).slice(2),
          selected: true,
          isDuplicate: !!existing,
          existingId: existing?.id,
        };
      });

      setParsedItems(items);
      setImportSummary(null);
    } catch (err: any) {
      alert(`Failed to parse file: ${err?.message || String(err)}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = parsedItems.every((i) => i.selected);
    setParsedItems(parsedItems.map((i) => ({ ...i, selected: !allSelected })));
  };

  const toggleSelectItem = (tempId: string) => {
    setParsedItems(
      parsedItems.map((i) => (i.tempId === tempId ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleExecuteImport = async () => {
    const selected = parsedItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    setIsImporting(true);
    const saved: SavedConnection[] = [];
    const currentExistingNames = existingConnections.map((c) => c.name);

    try {
      for (const item of selected) {
        let nameToUse = item.name;
        let idToUse: string | undefined = undefined;

        if (item.isDuplicate) {
          if (conflictStrategy === 'overwrite' && item.existingId) {
            idToUse = item.existingId;
          } else {
            let candidate = item.name;
            let counter = 1;
            while (currentExistingNames.includes(candidate)) {
              candidate = `${item.name} (${counter})`;
              counter++;
            }
            nameToUse = candidate;
          }
        }
        currentExistingNames.push(nameToUse);

        const savedConn = await onSaveConnection({
          id: idToUse || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
          name: nameToUse,
          host: item.host,
          port: item.port,
          username: item.username,
          authType: item.authType || 'password',
          password: item.password,
          passphrase: item.passphrase,
          privateKeyPath: item.privateKeyPath,
          folder: item.folder,
          bookmarks: item.bookmarks || [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        saved.push(savedConn);
      }

      setImportSummary(`Successfully imported ${saved.length} connection(s).`);
      onImportComplete(saved);
      setParsedItems([]);
    } catch (err: any) {
      alert(`Import error: ${err?.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportDownload = () => {
    let content = '';
    let filename = '';
    let mime = '';

    if (exportFormat === 'json') {
      content = exportToOpenTermJson(existingConnections);
      filename = `openterm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      mime = 'application/json';
    } else {
      content = exportToFileZillaXml(existingConnections);
      filename = `openterm-filezilla-${new Date().toISOString().slice(0, 10)}.xml`;
      mime = 'application/xml';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-xl bg-[#161722] border border-[#2e2f42] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262738] shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Import & Export Connections</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#262738] px-5 gap-6 text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'import'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="h-4 w-4" />
            Import (FileZilla XML / JSON)
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="h-4 w-4" />
            Export Connections
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 flex-1 overflow-y-auto min-h-0 space-y-4">
          {activeTab === 'import' ? (
            parsedItems.length === 0 ? (
              /* Dropzone */
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center ${
                    dragOver
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[#2e2f42] bg-[#11111a] hover:border-slate-500'
                  }`}
                >
                  <Upload className="h-10 w-10 text-indigo-400 mb-3" />
                  <p className="text-sm font-medium text-white mb-1">
                    Drag and drop FileZilla XML or OpenTerm JSON file
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Supports FileZilla Site Manager export (<code className="text-slate-300">.xml</code>) and OpenTerm backups (<code className="text-slate-300">.json</code>)
                  </p>
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow-sm"
                  >
                    Select File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,.json"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {importSummary && (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{importSummary}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Preview table */
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-slate-300 hover:text-white"
                    >
                      {parsedItems.every((i) => i.selected) ? (
                        <CheckSquare className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-500" />
                      )}
                      <span>Select All ({parsedItems.length})</span>
                    </button>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">
                      {parsedItems.filter((i) => i.selected).length} selected
                    </span>
                  </div>

                  {/* Conflict handling option */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Duplicates:</span>
                    <select
                      value={conflictStrategy}
                      onChange={(e) => setConflictStrategy(e.target.value as any)}
                      className="rounded bg-[#11111a] border border-[#2e2f42] px-2 py-1 text-xs text-white"
                    >
                      <option value="rename">Rename duplicates (suffix 1)</option>
                      <option value="overwrite">Overwrite existing</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-[#262738] rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-[#11111a]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#1a1b26] text-slate-400 sticky top-0 border-b border-[#262738]">
                      <tr>
                        <th className="p-2.5 w-8"></th>
                        <th className="p-2.5 font-medium">Name & Host</th>
                        <th className="p-2.5 font-medium">User</th>
                        <th className="p-2.5 font-medium">Folder</th>
                        <th className="p-2.5 font-medium">Bookmarks</th>
                        <th className="p-2.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#20212e]">
                      {parsedItems.map((item) => (
                        <tr
                          key={item.tempId}
                          onClick={() => toggleSelectItem(item.tempId)}
                          className={`cursor-pointer hover:bg-slate-800/40 transition-colors ${
                            item.selected ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5">
                            {item.selected ? (
                              <CheckSquare className="h-4 w-4 text-indigo-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600" />
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="font-medium text-white">{item.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {item.host}:{item.port}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-300">{item.username}</td>
                          <td className="p-2.5">
                            {item.folder ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                <Folder className="h-2.5 w-2.5 text-indigo-400" />
                                {item.folder}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {item.bookmarks && item.bookmarks.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                <Bookmark className="h-3 w-3 text-amber-400" />
                                {item.bookmarks.length}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            {item.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] bg-amber-950/50 text-amber-300 border border-amber-800/50">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Duplicate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] bg-emerald-950/50 text-emerald-300 border border-emerald-800/50">
                                <Check className="h-2.5 w-2.5" />
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cancel & Import Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setParsedItems([])}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Select different file
                  </button>
                  <button
                    disabled={isImporting || parsedItems.filter((i) => i.selected).length === 0}
                    onClick={handleExecuteImport}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white shadow-sm flex items-center gap-2"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {isImporting
                      ? 'Importing...'
                      : `Import ${parsedItems.filter((i) => i.selected).length} Connections`}
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Export tab */
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Export all {existingConnections.length} saved server profiles for backup or use in other applications.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('json')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                    exportFormat === 'json'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[#2e2f42] bg-[#11111a] hover:border-slate-600'
                  }`}
                >
                  <div>
                    <FileCode className="h-5 w-5 text-indigo-400 mb-2" />
                    <h3 className="text-xs font-semibold text-white">OpenTerm Backup (.json)</h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Complete backup including folders, SFTP directory bookmarks, and connection parameters.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium">
                    {exportFormat === 'json' && <Check className="h-3 w-3" />}
                    Recommended
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat('xml')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                    exportFormat === 'xml'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[#2e2f42] bg-[#11111a] hover:border-slate-600'
                  }`}
                >
                  <div>
                    <Server className="h-5 w-5 text-indigo-400 mb-2" />
                    <h3 className="text-xs font-semibold text-white">FileZilla Site Manager (.xml)</h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Export in FileZilla3 XML format compatible with FileZilla Site Manager import.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium">
                    {exportFormat === 'xml' && <Check className="h-3 w-3" />}
                    FileZilla Format
                  </div>
                </button>
              </div>

              <div className="pt-3 border-t border-[#262738] flex justify-end">
                <button
                  onClick={handleExportDownload}
                  disabled={existingConnections.length === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white shadow-sm flex items-center gap-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download {exportFormat.toUpperCase()} Export
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
