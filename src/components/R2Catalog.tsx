import React, { useState } from 'react';
import { Database, Search, ArrowDownCircle, Settings, CheckCircle2, Shield, Info, ExternalLink } from 'lucide-react';
import { ModelInfo, R2Config, RAMDiskState } from '../types';

interface R2CatalogProps {
  models: ModelInfo[];
  r2Config: R2Config;
  ramDisk: RAMDiskState;
  onOpenConfig: () => void;
  onLoadModelToRAM: (model: ModelInfo) => void;
  isLoadingModel: boolean;
  loadingModelId: string | null;
  loadingProgress: number;
}

export const R2Catalog: React.FC<R2CatalogProps> = ({
  models,
  r2Config,
  ramDisk,
  onOpenConfig,
  onLoadModelToRAM,
  isLoadingModel,
  loadingModelId,
  loadingProgress
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFamily, setActiveFamily] = useState<string>('all');
  const [inspectModel, setInspectModel] = useState<ModelInfo | null>(null);

  const families = ['all', 'Qwen', 'Llama', 'DeepSeek', 'Mistral', 'Gemma', 'Phi'];

  const filteredModels = models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.family.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFamily = activeFamily === 'all' || m.family.toLowerCase() === activeFamily.toLowerCase();
    return matchesSearch && matchesFamily;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar: R2 Status & Controls */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-semibold text-white">Cloudflare R2 Model Registry</h2>
            <span className="text-xs text-slate-400 font-mono">
              · {r2Config.bucketName || 'modeldock-registry'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            S3-compatible object storage with zero egress fees. Models stream in high-throughput chunks directly into volatile memory.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Configure R2</span>
          </button>
        </div>
      </div>

      {/* Streaming Progress Overlay if active */}
      {isLoadingModel && (
        <div className="p-4 bg-indigo-950/40 border border-indigo-700/60 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-indigo-300 flex items-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4 animate-bounce text-indigo-400" />
              Streaming {loadingModelId} into RAM-disk (/Volumes/{ramDisk.mountPoint || 'ModelDockRAM'})...
            </span>
            <span className="text-white font-bold">{Math.round(loadingProgress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-150"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Throughput: ~280 MB/s (Direct RAM write)</span>
            <span>Zero SSD Wear · SHA-256 Validating</span>
          </div>
        </div>
      )}

      {/* Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter models (e.g. qwen, 7b, deepseek)..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto max-w-full">
          {families.map((fam) => (
            <button
              key={fam}
              onClick={() => setActiveFamily(fam)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeFamily === fam
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fam === 'all' ? 'All Models' : fam}
            </button>
          ))}
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredModels.map((model) => {
          const isCurrentlyLoaded = ramDisk.loadedModel?.id === model.id;
          const isThisLoading = isLoadingModel && loadingModelId === model.id;

          return (
            <div
              key={model.id}
              className={`p-4 bg-slate-900/60 border rounded-lg flex flex-col justify-between transition-all ${
                isCurrentlyLoaded
                  ? 'border-indigo-500 shadow-sm shadow-indigo-950/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight">
                      {model.name}
                    </h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {model.author} · {model.parameters}
                    </div>
                  </div>
                  <button
                    onClick={() => setInspectModel(model)}
                    title="Inspect Checksum & Spec"
                    className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors cursor-pointer"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {model.description}
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono py-2 border-y border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Weight Size: </span>
                    <span className="text-emerald-400 font-semibold">{model.fileSizeGB} GB</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Quant: </span>
                    <span className="text-yellow-400 font-semibold">{model.quantization}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Context: </span>
                    <span className="text-slate-300">{model.contextLengthDefault.toLocaleString()} tok</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rec. RAM: </span>
                    <span className="text-indigo-300 font-semibold">~{model.recommendedMemoryGB} GB</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-500 truncate max-w-[150px]">
                  {model.r2Key.split('/').pop()}
                </span>

                {isCurrentlyLoaded ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium py-1 px-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    In RAM
                  </span>
                ) : (
                  <button
                    onClick={() => onLoadModelToRAM(model)}
                    disabled={isLoadingModel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    <span>{isThisLoading ? 'Streaming...' : 'Load to RAM'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Spec Modal */}
      {inspectModel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{inspectModel.name}</h3>
                <span className="text-xs text-slate-400 font-mono">{inspectModel.id}</span>
              </div>
              <button
                onClick={() => setInspectModel(null)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div>
                <span className="text-slate-400 block mb-0.5">R2 S3 Object Key:</span>
                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-indigo-300 break-all select-all">
                  {inspectModel.r2Key}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">SHA-256 Checksum (Integrity Verification):</span>
                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-emerald-400 break-all select-all">
                  {inspectModel.sha256}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-500 block">File Size</span>
                  <span className="text-white font-bold text-sm">{inspectModel.fileSizeGB} GB</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-500 block">Quantization Format</span>
                  <span className="text-yellow-400 font-bold text-sm">{inspectModel.quantization}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-2 leading-relaxed">
                When downloaded with ModelDock, the streaming engine computes SHA-256 in real time on 8MB chunks without writing intermediate cache files to SSD storage.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectModel(null)}
                className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
