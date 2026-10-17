import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, CornerDownLeft, Play, Trash2 } from 'lucide-react';
import { ModelInfo, RAMDiskState, ServerState } from '../types';

interface CliTerminalProps {
  ramDisk: RAMDiskState;
  serverState: ServerState;
  onExecuteCommand: (cmd: string) => string;
}

interface HistoryItem {
  id: string;
  command: string;
  output: string;
  timestamp: string;
}

export const CliTerminal: React.FC<CliTerminalProps> = ({
  ramDisk,
  serverState,
  onExecuteCommand
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'init-1',
      command: 'modeldock status',
      output: `ModelDock System Status:
  • Physical RAM: 36.0 GB (Apple Silicon Unified Memory)
  • RAM-Disk:     ${ramDisk.isMounted ? `MOUNTED at ${ramDisk.mountPoint} (${ramDisk.allocatedGB} GB)` : 'STANDBY / UNMOUNTED'}
  • Loaded Model: ${ramDisk.loadedModel ? ramDisk.loadedModel.name : 'None'}
  • Server State: ${serverState.status.toUpperCase()} (port: ${serverState.port})
  • SSD Writes:   0 Bytes (Guaranteed Volatile In-Memory)`,
      timestamp: '03:45:00'
    }
  ]);
  const [commandList, setCommandList] = useState<string[]>(['modeldock status']);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleRun = (cmdToRun: string) => {
    if (!cmdToRun.trim()) return;

    if (cmdToRun.trim() === 'clear') {
      setHistory([]);
      setInput('');
      return;
    }

    const output = onExecuteCommand(cmdToRun);
    const now = new Date().toLocaleTimeString();

    setHistory((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        command: cmdToRun,
        output,
        timestamp: now
      }
    ]);

    setCommandList((prev) => [...prev, cmdToRun]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRun(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandList.length > 0) {
        const nextIndex = historyIndex === -1 ? commandList.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInput(commandList[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < commandList.length) {
          setHistoryIndex(nextIndex);
          setInput(commandList[nextIndex]);
        } else {
          setHistoryIndex(-1);
          setInput('');
        }
      }
    }
  };

  const quickCommands = [
    'modeldock --help',
    'modeldock list',
    'modeldock load qwen-3b',
    'modeldock serve qwen-3b --port 8080',
    'modeldock status',
    'modeldock unload qwen-3b'
  ];

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            ModelDock macOS CLI Interactive Shell
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Simulates the exact Typer and Rich console runtime of the <code className="text-indigo-300 font-mono text-[11px]">modeldock</code> command on Apple Silicon.
          </p>
        </div>

        <button
          onClick={() => setHistory([])}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Screen</span>
        </button>
      </div>

      {/* Quick Command Suggestions */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-slate-500 whitespace-nowrap text-[11px]">Quick Run:</span>
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => handleRun(cmd)}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-slate-300 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-2.5 h-2.5 text-emerald-400" />
            <span>{cmd}</span>
          </button>
        ))}
      </div>

      {/* Terminal Window */}
      <div className="bg-[#080c14] border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[480px] shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
            <span className="ml-2 text-xs font-mono text-slate-400">zsh — modeldock@macbook-pro</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Darwin Kernel 24.3.0</span>
        </div>

        {/* Terminal Screen Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3 text-slate-200 select-text">
          <div className="text-slate-500 text-[11px] leading-relaxed">
            ModelDock v0.1.0 (Apple Silicon M-Series Metal Accelerated)<br />
            Type <span className="text-indigo-400">modeldock --help</span> or select any quick command above.
          </div>

          {history.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="text-indigo-400 font-bold">➜</span>
                <span className="text-sky-300">~</span>
                <span className="text-white font-semibold">{item.command}</span>
                <span className="text-[10px] text-slate-600 ml-auto">{item.timestamp}</span>
              </div>
              <pre className="text-slate-300 whitespace-pre-wrap pl-4 border-l border-slate-800 text-[11px] leading-relaxed">
                {item.output}
              </pre>
            </div>
          ))}

          {/* Prompt line */}
          <div className="flex items-center gap-2 pt-1 text-emerald-400">
            <span className="text-indigo-400 font-bold">➜</span>
            <span className="text-sky-300">~</span>
            <div className="flex-1 flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="modeldock <command>..."
                className="w-full bg-transparent text-white font-mono focus:outline-none text-xs placeholder-slate-600"
                autoFocus
              />
            </div>
            <button
              onClick={() => handleRun(input)}
              className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
