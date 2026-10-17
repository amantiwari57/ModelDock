import React from 'react';
import { Download, Terminal } from 'lucide-react';

interface HeaderProps {
  activeTab: 'ram' | 'catalog' | 'runner' | 'playground' | 'cli' | 'repo';
  setActiveTab: (tab: 'ram' | 'catalog' | 'runner' | 'playground' | 'cli' | 'repo') => void;
  onExportRepo: () => void;
  isExporting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportRepo,
  isExporting
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0b0f17]/95 backdrop-blur border-b border-slate-800">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-sm">
          <Terminal className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight text-white font-mono">
          ModelDock
        </span>
      </div>

      {/* Zone 2: 4–6 concise single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('ram')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'ram'
              ? 'text-white border-b-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          RAM & System
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'catalog'
              ? 'text-white border-b-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          R2 Models
        </button>

        <button
          onClick={() => setActiveTab('runner')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'runner'
              ? 'text-white border-b-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          llama.cpp Server
        </button>

        <button
          onClick={() => setActiveTab('playground')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'playground'
              ? 'text-white border-b-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          API Playground
        </button>

        <button
          onClick={() => setActiveTab('cli')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'cli'
              ? 'text-white border-b-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          CLI Terminal
        </button>

        <button
          onClick={() => setActiveTab('repo')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'repo'
              ? 'text-white border-b-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          GitHub Repo
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onExportRepo}
          disabled={isExporting}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Packaging...' : 'Export Repo (.zip)'}</span>
        </button>
      </div>
    </header>
  );
};
