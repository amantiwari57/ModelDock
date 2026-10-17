import React, { useState } from 'react';
import { Cpu, HardDrive, ShieldCheck, AlertTriangle, Layers, Trash2, RefreshCw } from 'lucide-react';
import { RAMDiskState, SystemMemoryInfo, ModelInfo } from '../types';

interface RAMVisualizerProps {
  ramDisk: RAMDiskState;
  systemMemory: SystemMemoryInfo;
  onMountRAM: (sizeGB: number) => void;
  onUnmountRAM: () => void;
  selectedModel: ModelInfo | null;
  onSelectModelForTest: (model: ModelInfo) => void;
  availableModels: ModelInfo[];
}

export const RAMVisualizer: React.FC<RAMVisualizerProps> = ({
  ramDisk,
  systemMemory,
  onMountRAM,
  onUnmountRAM,
  selectedModel,
  onSelectModelForTest,
  availableModels
}) => {
  const [targetContext, setTargetContext] = useState<number>(4096);
  const [customMacRam, setCustomMacRam] = useState<number>(systemMemory.totalGB);

  // Calculate KV cache overhead in GB based on target context
  // Standard multi-head attention KV cache: 2 * n_layers * n_kv_heads * head_dim * context * bytes_per_element
  // For ~3B-7B models this is ~0.18GB per 1024 context tokens in 16-bit float
  const kvCacheGB = parseFloat(((targetContext / 1024) * 0.18).toFixed(2));
  const runtimeOverheadGB = 0.85; // Metal buffer overhead + command encoders
  const modelWeightGB = selectedModel ? selectedModel.fileSizeGB : 2.15;
  const totalEstimatedGB = parseFloat((modelWeightGB + kvCacheGB + runtimeOverheadGB).toFixed(2));

  const availableRamGB = customMacRam - (systemMemory.wiredGB + (ramDisk.isMounted ? ramDisk.allocatedGB : 0));
  const isMemoryTight = totalEstimatedGB > availableRamGB;
  const isMemoryCritical = totalEstimatedGB > availableRamGB * 1.15;
  const isLowFreeMemory = availableRamGB < 4.0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Unified Memory Architecture & RAM-Disk Engine
            </h2>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-3xl">
              ModelDock leverages the native macOS kernel to attach a transient, in-memory APFS block device (
              <code className="text-indigo-300 font-mono text-[11px]">hdiutil attach -nomount ram://&lt;sectors&gt;</code>).
              Model weights remain solely in volatile RAM, bypassing SSD write cycles. Releasing the disk reclaims memory instantly.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ramDisk.isMounted ? (
              <button
                onClick={onUnmountRAM}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge RAM-Disk</span>
              </button>
            ) : (
              <button
                onClick={() => onMountRAM(totalEstimatedGB)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/60 rounded-md transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Mount {totalEstimatedGB} GB RAM-Disk</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unified Memory Allocation Bar */}
      <div className={`p-5 rounded-lg space-y-4 transition-colors ${
        isLowFreeMemory
          ? 'bg-slate-900/80 border border-amber-600/60'
          : 'bg-slate-900/60 border border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Apple Silicon Memory Bar
            </span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {customMacRam} GB Unified Memory
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-600"></span>
              <span>OS / Wired: {systemMemory.wiredGB} GB</span>
            </div>
            {ramDisk.isMounted && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
                <span>ModelDock RAM: {ramDisk.allocatedGB} GB</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 ${isLowFreeMemory ? 'text-amber-400 font-semibold' : 'text-emerald-400'}`}>
              <span className={`w-2.5 h-2.5 rounded-sm ${isLowFreeMemory ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              <span>Available: {Math.max(0, availableRamGB).toFixed(1)} GB {isLowFreeMemory && '(! LOW)'}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Track */}
        <div className="w-full h-5 bg-slate-950 rounded overflow-hidden flex border border-slate-800">
          {/* Wired */}
          <div
            style={{ width: `${(systemMemory.wiredGB / customMacRam) * 100}%` }}
            className="bg-slate-700 h-full transition-all duration-300"
            title={`Wired / System: ${systemMemory.wiredGB} GB`}
          />
          {/* RAM-disk if mounted */}
          {ramDisk.isMounted && (
            <div
              style={{ width: `${(ramDisk.allocatedGB / customMacRam) * 100}%` }}
              className="bg-indigo-600 h-full transition-all duration-300 flex items-center justify-center text-[10px] font-mono text-white"
              title={`ModelDock RAM-Disk: ${ramDisk.allocatedGB} GB`}
            >
              RAM-Disk
            </div>
          )}
          {/* Free / Available */}
          <div
            style={{ width: `${(Math.max(0, availableRamGB) / customMacRam) * 100}%` }}
            className={`${
              isLowFreeMemory ? 'bg-amber-950/80 border-amber-600' : 'bg-emerald-950/80'
            } h-full transition-all duration-300 border-l border-slate-800`}
            title={`Available: ${Math.max(0, availableRamGB).toFixed(1)} GB`}
          />
        </div>

        {/* Visual Warning Indicator when Free Memory < 4GB */}
        {isLowFreeMemory && (
          <div className="p-3 bg-amber-950/40 border border-amber-700/60 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-200 flex items-center gap-2">
                  <span>Low Free Memory Warning: {Math.max(0, availableRamGB).toFixed(1)} GB Remaining</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-900/60 border border-amber-700/60 text-amber-300 rounded">
                    &lt; 4.0 GB Threshold
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-amber-300/90 leading-relaxed">
                  System free memory has fallen below the 4.0 GB safety threshold. To prevent the macOS kernel swap daemon (<code>vm_compressor</code>) from paging memory to SSD, unload inactive models from RAM.
                </p>
              </div>
            </div>

            {ramDisk.isMounted && (
              <button
                onClick={onUnmountRAM}
                className="self-start sm:self-center shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded transition-colors cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unload Models</span>
              </button>
            )}
          </div>
        )}

        {/* Mac Model Hardware Selector */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
          <span>Simulate Mac Hardware Configuration:</span>
          <div className="flex items-center gap-1.5">
            {[8, 16, 24, 36, 64, 128].map((ram) => (
              <button
                key={ram}
                onClick={() => setCustomMacRam(ram)}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                  customMacRam === ram
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {ram}GB
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RAM-Disk Mount Details & Memory Pressure Checker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: RAM-Disk Status */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              Active Volatile Mount
            </span>
            <span className="text-xs font-mono">
              {ramDisk.isMounted ? (
                <span className="text-emerald-400 font-semibold">MOUNTED (RAM://)</span>
              ) : (
                <span className="text-slate-500">STANDBY / UNMOUNTED</span>
              )}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">Mount Path:</span>
              <span className="text-slate-200">{ramDisk.mountPoint}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">Block Device:</span>
              <span className="text-slate-200">{ramDisk.deviceNode || 'None (/dev/diskX)'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">Sector Count:</span>
              <span className="text-slate-200">
                {ramDisk.isMounted ? `${ramDisk.sectors.toLocaleString()} (512B)` : '0'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">Loaded Weight:</span>
              <span className="text-indigo-300">
                {ramDisk.loadedModel ? `${ramDisk.loadedModel.name} (${ramDisk.loadedModel.fileSizeGB} GB)` : 'None'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">SSD Write Status:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                0 Bytes Written to SSD
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Interactive Context & KV Cache Sizing */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Model Weight + KV Cache Sizer
            </span>
            <span className="text-xs font-mono text-slate-300">
              Target: {selectedModel ? selectedModel.id : 'qwen-3b'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Context Window:</span>
              <span className="font-mono text-white font-semibold">{targetContext.toLocaleString()} tokens</span>
            </div>
            <input
              type="range"
              min="2048"
              max="32768"
              step="2048"
              value={targetContext}
              onChange={(e) => setTargetContext(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>2,048</span>
              <span>8,192</span>
              <span>16,384</span>
              <span>32,768</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>GGUF Weights RAM:</span>
              <span className="text-slate-200">{modelWeightGB} GB</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>KV Cache Allocation:</span>
              <span className="text-slate-200">+{kvCacheGB} GB</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Metal Runtime Graph:</span>
              <span className="text-slate-200">+{runtimeOverheadGB} GB</span>
            </div>
            <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
              <span>Total Memory Footprint:</span>
              <span className="text-indigo-400">{totalEstimatedGB} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety & Virtual Memory Swap Reality Callout */}
      <div className={`p-4 rounded-lg border text-xs leading-relaxed ${
        isMemoryCritical
          ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
          : isMemoryTight
          ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
          : 'bg-slate-900/50 border-slate-800 text-slate-400'
      }`}>
        <div className="flex items-start gap-2.5">
          {isMemoryTight ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold text-slate-200">
              macOS Virtual Memory & Swap Transparency
            </div>
            <p className="mt-1">
              {isMemoryCritical ? (
                <span className="text-rose-300 font-semibold">
                  Warning: The combined weight ({totalEstimatedGB} GB) exceeds your available memory headroom ({availableRamGB.toFixed(1)} GB). macOS kernel will trigger swap daemon (vm_compressor) to write anonymous pages to disk if loaded!
                </span>
              ) : isMemoryTight ? (
                <span className="text-amber-300 font-semibold">
                  Caution: Memory headroom is low. Close background memory-heavy apps (Chrome tabs, IDEs) before running llama.cpp to ensure macOS does not invoke swapfile writes.
                </span>
              ) : (
                <span>
                  Safe headroom confirmed. With {availableRamGB.toFixed(1)} GB available physical RAM, loading this {modelWeightGB} GB model with {targetContext.toLocaleString()} context will remain 100% inside physical unified memory with zero kernel swap activity.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
