import React, { useState } from 'react';
import { Folder, FileCode, Copy, Check, Download, ExternalLink, Code2, Sparkles, Terminal } from 'lucide-react';
import { RepoFile, REPOSITORY_FILES } from '../data/repoFiles';

interface RepoExplorerProps {
  onExportRepo: () => void;
  isExporting: boolean;
}

export const RepoExplorer: React.FC<RepoExplorerProps> = ({
  onExportRepo,
  isExporting
}) => {
  const [selectedFile, setSelectedFile] = useState<RepoFile>(
    REPOSITORY_FILES.find((f) => f.path === 'src/modeldock/cli.py') || REPOSITORY_FILES[0]
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group files by folder
  const fileTree = [
    {
      folder: "src/modeldock/",
      files: REPOSITORY_FILES.filter((f) => f.path.startsWith("src/modeldock/"))
    },
    {
      folder: "tests/",
      files: REPOSITORY_FILES.filter((f) => f.path.startsWith("tests/"))
    },
    {
      folder: "Formula & Scripts",
      files: REPOSITORY_FILES.filter((f) => f.path.startsWith("Formula/") || f.path.startsWith("scripts/"))
    },
    {
      folder: "Root Configuration",
      files: REPOSITORY_FILES.filter(
        (f) => !f.path.includes("/")
      )
    }
  ];

  const lines = selectedFile.content.split('\n');

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            ModelDock Open-Source Repository Tree
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Full Python implementation with Typer, Boto3 S3 R2 streaming, macOS native hdiutil kernel RAM management, pytest coverage, and Homebrew tap formula.
          </p>
        </div>

        <button
          onClick={onExportRepo}
          disabled={isExporting}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors cursor-pointer shadow-xs whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Packaging...' : 'Export Entire Repo (.zip)'}</span>
        </button>
      </div>

      {/* Two-Pane File Explorer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[600px]">
        {/* Left Sidebar: File Tree */}
        <div className="md:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto space-y-3">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider px-1">
            Files ({REPOSITORY_FILES.length})
          </div>

          <div className="space-y-3 text-xs font-mono">
            {fileTree.map((group) => (
              <div key={group.folder} className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px] px-1">
                  <Folder className="w-3.5 h-3.5 text-sky-400" />
                  <span>{group.folder}</span>
                </div>

                <div className="pl-3 space-y-0.5 border-l border-slate-800 ml-2">
                  {group.files.map((file) => {
                    const isSelected = selectedFile.path === file.path;
                    const fileName = file.path.split('/').pop();

                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: Code Viewer */}
        <div className="md:col-span-8 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
          {/* File Header Bar */}
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-white font-semibold">{selectedFile.path}</span>
              <span className="text-[11px] text-slate-400 font-mono">· {selectedFile.description}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSingle}
                title="Download this file"
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCopy}
                title="Copy code"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Code Viewer Body */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200 select-text">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="w-10 pr-4 text-right text-slate-600 select-none text-[11px] align-top font-mono">
                      {idx + 1}
                    </td>
                    <td className="whitespace-pre font-mono text-slate-300">
                      {line || '\n'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
