import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RefreshCw, Terminal, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { ServerState, ServerLog, ModelInfo, RAMDiskState } from '../types';

interface LlamaRunnerProps {
  serverState: ServerState;
  logs: ServerLog[];
  ramDisk: RAMDiskState;
  onStartServer: (params: { port: number; gpuLayers: number; contextSize: number; batchSize: number }) => void;
  onStopServer: () => void;
  onClearLogs: () => void;
  onNavigateToPlayground: () => void;
}

export const LlamaRunner: React.FC<LlamaRunnerProps> = ({
  serverState,
  logs,
  ramDisk,
  onStartServer,
  onStopServer,
  onClearLogs,
  onNavigateToPlayground
}) => {
  const [port, setPort] = useState<number>(serverState.port || 8080);
  const [gpuLayers, setGpuLayers] = useState<number>(serverState.gpuLayers || 99);
  const [contextSize, setContextSize] = useState<number>(serverState.contextSize || 4096);
  const [batchSize, setBatchSize] = useState<number>(serverState.batchSize || 512);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const activeModel = ramDisk.loadedModel;

  const curlCommand = `curl http://${serverState.host}:${port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${activeModel ? activeModel.id : 'default'}",
    "messages": [{"role": "user", "content": "Explain RAM-disks in 2 sentences"}]
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Status Overview */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">llama.cpp Inference Supervisor</h2>
            <span className="text-xs text-slate-400 font-mono">
              · llama-server (Metal Accelerated)
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Official llama.cpp binary supervisor reading weights straight from the in-memory mount. Provides an OpenAI-compatible API on port {port}.
          </p>
        </div>

        {/* Server Actions */}
        <div className="flex items-center gap-2.5">
          {serverState.status === 'running' ? (
            <>
              <button
                onClick={onNavigateToPlayground}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors cursor-pointer"
              >
                Open Playground
              </button>
              <button
                onClick={onStopServer}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-200 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 rounded transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Server</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onStartServer({ port, gpuLayers, contextSize, batchSize })}
              disabled={!ramDisk.isMounted || !activeModel || serverState.status === 'starting'}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 rounded transition-colors cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{serverState.status === 'starting' ? 'Initializing Metal...' : 'Launch Server'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning if no model in RAM */}
      {!ramDisk.isMounted || !activeModel ? (
        <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>No model currently loaded in volatile RAM. Load a model from the R2 catalog first to start the inference server.</span>
          </div>
        </div>
      ) : null}

      {/* Configuration & Parameter Knobs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            HTTP Port (--port)
          </label>
          <input
            type="number"
            disabled={serverState.status === 'running'}
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Metal Layers (-ngl)
          </label>
          <input
            type="number"
            disabled={serverState.status === 'running'}
            value={gpuLayers}
            onChange={(e) => setGpuLayers(parseInt(e.target.value) || 99)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Context Size (-c)
          </label>
          <input
            type="number"
            step="1024"
            disabled={serverState.status === 'running'}
            value={contextSize}
            onChange={(e) => setContextSize(parseInt(e.target.value) || 4096)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Batch Size (-b)
          </label>
          <input
            type="number"
            step="128"
            disabled={serverState.status === 'running'}
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || 512)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono focus:border-indigo-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Terminal Live Stdout/Stderr Feed */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[340px]">
        {/* Terminal Header */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
            <span className="text-xs font-mono text-slate-300">
              llama-server process feed {serverState.pid ? `(PID: ${serverState.pid})` : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono">
              {serverState.status === 'running' ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  HEALTHY (200 OK)
                </span>
              ) : serverState.status === 'starting' ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  INITIALIZING
                </span>
              ) : (
                <span className="text-slate-500">STOPPED</span>
              )}
            </span>

            <button
              onClick={onClearLogs}
              className="text-[11px] text-slate-500 hover:text-slate-300 font-mono cursor-pointer"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Log Lines */}
        <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1 text-slate-300 select-text">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-4 text-center">
              No server activity yet. Click "Launch Server" above to initialize llama.cpp.
            </div>
          ) : (
            logs.map((log) => {
              let color = 'text-slate-300';
              if (log.type === 'stderr' || log.type === 'error') color = 'text-rose-400';
              if (log.type === 'warn') color = 'text-amber-400';
              if (log.type === 'request') color = 'text-indigo-400';

              return (
                <div key={log.id} className="leading-relaxed flex items-start gap-2">
                  <span className="text-slate-600 select-none text-[11px]">{log.timestamp}</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Fast cURL Test Card */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Quick Test via Terminal cURL
          </span>
          <button
            onClick={handleCopyCurl}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCurl ? 'Copied!' : 'Copy cURL'}</span>
          </button>
        </div>
        <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
          {curlCommand}
        </pre>
      </div>
    </div>
  );
};
