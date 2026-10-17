import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Header } from './components/Header';
import { RAMVisualizer } from './components/RAMVisualizer';
import { R2Catalog } from './components/R2Catalog';
import { LlamaRunner } from './components/LlamaRunner';
import { ApiPlayground } from './components/ApiPlayground';
import { CliTerminal } from './components/CliTerminal';
import { RepoExplorer } from './components/RepoExplorer';
import { R2ConfigModal } from './components/R2ConfigModal';

import { DEFAULT_MODELS } from './data/defaultModels';
import { REPOSITORY_FILES } from './data/repoFiles';
import { ModelInfo, RAMDiskState, SystemMemoryInfo, ServerState, ServerLog, R2Config, ChatMessage } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'ram' | 'catalog' | 'runner' | 'playground' | 'cli' | 'repo'>('ram');
  const [isExporting, setIsExporting] = useState(false);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);

  // Models
  const [models, setModels] = useState<ModelInfo[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(DEFAULT_MODELS[0]);

  // RAM-Disk state
  const [ramDisk, setRamDisk] = useState<RAMDiskState>({
    isMounted: true,
    mountPoint: '/Volumes/ModelDockRAM',
    deviceNode: '/dev/disk4',
    allocatedGB: 4.5,
    usedGB: 2.15,
    sectors: 9437184,
    loadedModel: DEFAULT_MODELS[0],
    mountTime: '10:32:14'
  });

  // System unified memory info
  const [systemMemory, setSystemMemory] = useState<SystemMemoryInfo>({
    totalGB: 36.0,
    wiredGB: 8.4,
    activeGB: 11.2,
    compressedGB: 1.1,
    freeGB: 10.8,
    swapUsedGB: 0.0,
    pressureState: 'normal'
  });

  // R2 configuration
  const [r2Config, setR2Config] = useState<R2Config>({
    accountId: 'a84d9f10928e374f67c91a0293847291',
    accessKeyId: 'r2_pub_cf_923847921849210',
    secretAccessKey: 'r2_sec_cf_89327498213749812739812739812739',
    bucketName: 'modeldock-registry',
    endpointUrl: 'https://a84d9f10928e374f67c91a0293847291.r2.cloudflarestorage.com',
    region: 'auto',
    isConfigured: true,
    demoMode: true
  });

  // Streaming download state
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Server state
  const [serverState, setServerState] = useState<ServerState>({
    status: 'running',
    pid: 48921,
    port: 8080,
    host: '127.0.0.1',
    model: DEFAULT_MODELS[0],
    gpuLayers: 99,
    contextSize: 4096,
    batchSize: 512,
    threads: 8,
    startedAt: '10:33:00',
    requestCount: 3,
    tokensGenerated: 428,
    lastTps: 74.2,
    lastTtftMs: 118
  });

  // Server logs
  const [logs, setLogs] = useState<ServerLog[]>([
    {
      id: 'log-1',
      timestamp: '10:32:58',
      type: 'info',
      message: 'main: build = 3698 (6150247) with Apple Metal support'
    },
    {
      id: 'log-2',
      timestamp: '10:32:59',
      type: 'stdout',
      message: 'llama_model_loader: loaded meta data from /Volumes/ModelDockRAM/qwen2.5-3b-instruct-q4_k_m.gguf'
    },
    {
      id: 'log-3',
      timestamp: '10:32:59',
      type: 'stdout',
      message: 'ggml_metal_init: allocating Metal buffers for GPU offloading (99 layers on Apple M3 Max)'
    },
    {
      id: 'log-4',
      timestamp: '10:33:00',
      type: 'stdout',
      message: 'HTTP server listening on http://127.0.0.1:8080 (ready for OpenAI API requests)'
    }
  ]);

  // Chat messages for playground
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      role: 'user',
      content: 'Explain why running LLMs out of a RAM-disk on macOS avoids SSD wear.',
      timestamp: '10:34:10'
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: `On Apple Silicon, unified memory is directly shared between the CPU and GPU cores at up to 400 GB/s bandwidth. 

When you attach a macOS RAM-disk (\`hdiutil attach -nomount ram://\`), the operating system maps raw kernel memory sectors into an APFS mount point. When ModelDock streams GGUF weights from Cloudflare R2 directly into this volume:

1. **Zero Flash NAND Wear**: Model files never touch the internal SSD filesystem, avoiding tens of gigabytes of flash writes per model test.
2. **Instant Reclamation**: Unmounting the disk discards the allocated sectors in milliseconds.
3. **Safe Virtual Memory Guarding**: As long as available physical RAM exceeds model weights + KV cache headroom, macOS avoids paging anonymous memory to the swap file.`,
      timestamp: '10:34:12',
      tps: 76.5,
      ttftMs: 114
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Mount RAM-disk handler
  const handleMountRAM = (sizeGB: number) => {
    const sectors = Math.round((sizeGB * 1024 * 1024) / 512);
    setRamDisk({
      isMounted: true,
      mountPoint: '/Volumes/ModelDockRAM',
      deviceNode: '/dev/disk4',
      allocatedGB: parseFloat(sizeGB.toFixed(1)),
      usedGB: 0,
      sectors,
      loadedModel: null,
      mountTime: new Date().toLocaleTimeString()
    });

    addLog('info', `hdiutil attach -nomount ram://${sectors} -> created /dev/disk4`);
    addLog('stdout', `diskutil eraseDisk APFS ModelDockRAM /dev/disk4 -> mounted at /Volumes/ModelDockRAM`);
  };

  // Unmount RAM-disk handler
  const handleUnmountRAM = () => {
    // Stop server first if running
    if (serverState.status === 'running') {
      handleStopServer();
    }

    setRamDisk({
      isMounted: false,
      mountPoint: '/Volumes/ModelDockRAM',
      deviceNode: null,
      allocatedGB: 0,
      usedGB: 0,
      sectors: 0,
      loadedModel: null,
      mountTime: null
    });

    addLog('warn', 'hdiutil detach /Volumes/ModelDockRAM -force -> volatile memory reclaimed by macOS');
  };

  // Stream model from R2 into RAM handler
  const handleLoadModelToRAM = (model: ModelInfo) => {
    // If RAM-disk is not mounted or too small, allocate it
    const requiredSize = model.fileSizeGB + 2.0;
    if (!ramDisk.isMounted || ramDisk.allocatedGB < requiredSize) {
      handleMountRAM(requiredSize);
    }

    setIsLoadingModel(true);
    setLoadingModelId(model.id);
    setLoadingProgress(0);

    addLog('request', `R2 GetObject: streaming ${model.r2Key} (${model.fileSizeGB} GB) into /Volumes/ModelDockRAM...`);

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsLoadingModel(false);
            setLoadingModelId(null);
            setLoadingProgress(100);

            setRamDisk((r) => ({
              ...r,
              usedGB: model.fileSizeGB,
              loadedModel: model
            }));

            setSelectedModel(model);
            addLog('stdout', `SHA-256 verified [${model.sha256.substring(0, 16)}...]: zero SSD writes`);
            addLog('info', `Model ${model.name} is now resident in volatile memory. Ready to serve.`);
            setActiveTab('runner');
          }, 300);
          return 100;
        }
        return prev + 15;
      });
    }, 120);
  };

  // llama.cpp Server Controls
  const handleStartServer = (params: { port: number; gpuLayers: number; contextSize: number; batchSize: number }) => {
    if (!ramDisk.loadedModel) return;

    setServerState((prev) => ({
      ...prev,
      status: 'starting',
      port: params.port,
      gpuLayers: params.gpuLayers,
      contextSize: params.contextSize,
      batchSize: params.batchSize
    }));

    addLog('info', `Starting llama-server -m /Volumes/ModelDockRAM/${ramDisk.loadedModel.r2Key.split('/').pop()} --port ${params.port} -ngl ${params.gpuLayers} -c ${params.contextSize}`);

    setTimeout(() => {
      setServerState((prev) => ({
        ...prev,
        status: 'running',
        pid: Math.floor(10000 + Math.random() * 80000),
        startedAt: new Date().toLocaleTimeString(),
        model: ramDisk.loadedModel
      }));
      addLog('stdout', `Metal: allocated ${params.gpuLayers} layers to Apple Silicon GPU`);
      addLog('stdout', `HTTP server listening on http://127.0.0.1:${params.port} (OpenAI-compatible)`);
    }, 1200);
  };

  const handleStopServer = () => {
    setServerState((prev) => ({
      ...prev,
      status: 'stopping'
    }));

    addLog('warn', 'Sending SIGTERM to llama-server process...');

    setTimeout(() => {
      setServerState((prev) => ({
        ...prev,
        status: 'stopped',
        pid: null,
        startedAt: null
      }));
      addLog('info', 'llama-server exited cleanly with code 0.');
    }, 600);
  };

  const addLog = (type: ServerLog['type'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message
      }
    ]);
  };

  // API Playground Chat Handler
  const handleSendMessage = async (content: string) => {
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    addLog('request', `POST /v1/chat/completions (model: ${ramDisk.loadedModel?.id || 'default'})`);

    // Simulate fast Apple Silicon generation with streaming tokens
    setTimeout(() => {
      const activeName = ramDisk.loadedModel?.name || 'Qwen 2.5 3B';
      const responses: Record<string, string> = {
        default: `Running inference locally with ${activeName} via Apple Silicon Metal acceleration.

Key execution stats:
- Model Weights Location: /Volumes/ModelDockRAM (Volatile RAM)
- Metal Acceleration: Enabled (Unified Memory Pipeline)
- Persistent Disk I/O: 0 bytes written to SSD
- Latency: First token in 118ms`
      };

      let answer = responses.default;
      if (content.toLowerCase().includes('benchmark') || content.toLowerCase().includes('python')) {
        answer = `Here is a lightweight benchmark script to test RAM-disk throughput on macOS:

\`\`\`python
import time
from pathlib import Path

mount = Path("/Volumes/ModelDockRAM")
test_file = mount / "benchmark.bin"
data = b"0" * (1024 * 1024 * 512) # 512 MB

start = time.perf_counter()
test_file.write_bytes(data)
write_duration = time.perf_counter() - start

start = time.perf_counter()
_ = test_file.read_bytes()
read_duration = time.perf_counter() - start

test_file.unlink()

print(f"RAM-disk Write: {512 / write_duration:.2f} MB/s")
print(f"RAM-disk Read:  {512 / read_duration:.2f} MB/s")
\`\`\``;
      } else if (content.toLowerCase().includes('homebrew') || content.toLowerCase().includes('formula')) {
        answer = `Homebrew formula description for ModelDock:

\`\`\`ruby
desc "Zero-SSD local LLM runner for macOS via Cloudflare R2 and RAM-disks"
homepage "https://github.com/modeldock/modeldock"
depends_on "python@3.11"
depends_on "llama.cpp"
\`\`\`

Allows installing with a single command:
\`brew tap modeldock/tap && brew install modeldock\``;
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: answer,
        timestamp: new Date().toLocaleTimeString(),
        tps: parseFloat((65 + Math.random() * 20).toFixed(1)),
        ttftMs: Math.floor(100 + Math.random() * 30)
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsGenerating(false);

      setServerState((prev) => ({
        ...prev,
        requestCount: prev.requestCount + 1,
        tokensGenerated: prev.tokensGenerated + 140,
        lastTps: assistantMsg.tps || 72.0,
        lastTtftMs: assistantMsg.ttftMs || 115
      }));

      addLog('stdout', `HTTP/1.1 200 OK — ${assistantMsg.tps} t/s, TTFT: ${assistantMsg.ttftMs}ms`);
    }, 700);
  };

  // CLI Shell Command Runner
  const handleExecuteCli = (cmd: string): string => {
    const parts = cmd.trim().split(/\s+/);
    const main = parts[0];
    const sub = parts[1];

    if (main !== 'modeldock') {
      return `zsh: command not found: ${main}. Try 'modeldock --help'`;
    }

    if (!sub || sub === '--help' || sub === '-h') {
      return `Usage: modeldock [OPTIONS] COMMAND [ARGS]...

  Zero-SSD local LLM runner for macOS: stream GGUFs from Cloudflare R2 into RAM-disks.

Commands:
  configure   Configure Cloudflare R2 credentials and bucket.
  list        List models in Cloudflare R2 bucket and catalog.
  load        Allocate macOS RAM-disk and stream GGUF into volatile RAM.
  serve       Launch llama.cpp Metal server on RAM-resident model.
  status      Display active RAM-disk allocation and unified memory state.
  unload      Stop server and purge RAM-disk, releasing all memory.
  purge       Force-unmount any orphan ModelDock RAM volumes.`;
    }

    if (sub === 'status') {
      return `ModelDock System Status:
  • Physical RAM: ${systemMemory.totalGB} GB Unified Memory
  • RAM-Disk:     ${ramDisk.isMounted ? `MOUNTED at ${ramDisk.mountPoint} (${ramDisk.allocatedGB} GB allocated)` : 'UNMOUNTED'}
  • Loaded Model: ${ramDisk.loadedModel ? `${ramDisk.loadedModel.name} (${ramDisk.loadedModel.fileSizeGB} GB)` : 'None'}
  • llama-server: ${serverState.status === 'running' ? `RUNNING (PID: ${serverState.pid}, port: ${serverState.port})` : 'STOPPED'}
  • SSD Wear:     0 bytes written to internal flash storage`;
    }

    if (sub === 'list') {
      return `ModelDock Model Catalog:
  ID              NAME                          SIZE      QUANT     REC RAM
  qwen-3b         Qwen 2.5 3B Instruct          2.15 GB   Q4_K_M    ~4.5 GB
  llama-3.2-3b    Llama 3.2 3B Instruct         2.02 GB   Q4_K_M    ~4.2 GB
  deepseek-r1-7b  DeepSeek R1 Distill Qwen 7B   4.68 GB   Q4_K_M    ~8.0 GB
  mistral-7b      Mistral 7B Instruct v0.3      4.37 GB   Q4_K_M    ~7.5 GB
  gemma-2-2b      Gemma 2 2B Instruct           2.78 GB   Q8_0      ~5.0 GB
  phi-4-mini      Phi-4 Mini 3.8B Instruct      2.49 GB   Q4_K_M    ~5.2 GB

Connected R2 Bucket: ${r2Config.bucketName} (Zero egress fees enabled)`;
    }

    if (sub === 'configure') {
      setIsR2ModalOpen(true);
      return `Opening Cloudflare R2 configuration modal...
Target Bucket: ${r2Config.bucketName}
Account ID:    ${r2Config.accountId ? `${r2Config.accountId.substring(0, 6)}...` : 'Not set'}`;
    }

    if (sub === 'load') {
      const targetId = parts[2] || 'qwen-3b';
      const targetModel = models.find((m) => m.id === targetId) || models[0];
      handleLoadModelToRAM(targetModel);
      return `Allocating volatile RAM-disk (${targetModel.fileSizeGB + 2.0} GB) via hdiutil...
Streaming ${targetModel.r2Key} from Cloudflare R2...
SHA-256 Checksum verified. Model loaded into ${ramDisk.mountPoint}.
Run 'modeldock serve ${targetModel.id}' to launch local server.`;
    }

    if (sub === 'serve') {
      const targetId = parts[2] || (ramDisk.loadedModel ? ramDisk.loadedModel.id : 'qwen-3b');
      handleStartServer({ port: 8080, gpuLayers: 99, contextSize: 4096, batchSize: 512 });
      return `Starting llama-server for ${targetId}...
Metal GPU offloading: 99 layers
Listening on http://127.0.0.1:8080 (OpenAI-compatible)
Server is now healthy. Press Ctrl+C to stop.`;
    }

    if (sub === 'unload' || sub === 'purge') {
      handleUnmountRAM();
      return `Stopped llama-server process.
Purged volatile RAM-disk at /Volumes/ModelDockRAM.
Released all allocated memory back to macOS kernel.
Total SSD writes recorded: 0 Bytes.`;
    }

    return `Unknown command: 'modeldock ${sub}'. Run 'modeldock --help' for commands.`;
  };

  // 1-Click ZIP Exporter for entire GitHub Repository
  const handleExportRepoZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();

      // Add each file to the zip
      REPOSITORY_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Generate blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modeldock-open-source.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to zip repository:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportRepo={handleExportRepoZip}
        isExporting={isExporting}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'ram' && (
          <RAMVisualizer
            ramDisk={ramDisk}
            systemMemory={systemMemory}
            onMountRAM={handleMountRAM}
            onUnmountRAM={handleUnmountRAM}
            selectedModel={selectedModel}
            onSelectModelForTest={setSelectedModel}
            availableModels={models}
          />
        )}

        {activeTab === 'catalog' && (
          <R2Catalog
            models={models}
            r2Config={r2Config}
            ramDisk={ramDisk}
            onOpenConfig={() => setIsR2ModalOpen(true)}
            onLoadModelToRAM={handleLoadModelToRAM}
            isLoadingModel={isLoadingModel}
            loadingModelId={loadingModelId}
            loadingProgress={loadingProgress}
          />
        )}

        {activeTab === 'runner' && (
          <LlamaRunner
            serverState={serverState}
            logs={logs}
            ramDisk={ramDisk}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onClearLogs={() => setLogs([])}
            onNavigateToPlayground={() => setActiveTab('playground')}
          />
        )}

        {activeTab === 'playground' && (
          <ApiPlayground
            serverState={serverState}
            ramDisk={ramDisk}
            onSendMessage={handleSendMessage}
            messages={messages}
            isGenerating={isGenerating}
            onClearChat={() => setMessages([])}
          />
        )}

        {activeTab === 'cli' && (
          <CliTerminal
            ramDisk={ramDisk}
            serverState={serverState}
            onExecuteCommand={handleExecuteCli}
          />
        )}

        {activeTab === 'repo' && (
          <RepoExplorer
            onExportRepo={handleExportRepoZip}
            isExporting={isExporting}
          />
        )}
      </main>

      {/* R2 Credentials Configuration Modal */}
      <R2ConfigModal
        isOpen={isR2ModalOpen}
        onClose={() => setIsR2ModalOpen(false)}
        config={r2Config}
        onSaveConfig={(newConfig) => {
          setR2Config(newConfig);
          addLog('info', `Cloudflare R2 configuration updated for bucket: ${newConfig.bucketName}`);
        }}
      />
    </div>
  );
}
