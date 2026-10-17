export interface ModelInfo {
  id: string;
  name: string;
  family: string;
  parameters: string;
  quantization: string;
  fileSizeGB: number;
  r2Key: string;
  bucket: string;
  sha256: string;
  contextLengthDefault: number;
  recommendedMemoryGB: number;
  description: string;
  author: string;
}

export interface RAMDiskState {
  isMounted: boolean;
  mountPoint: string;
  deviceNode: string | null;
  allocatedGB: number;
  usedGB: number;
  sectors: number;
  loadedModel: ModelInfo | null;
  mountTime: string | null;
}

export interface SystemMemoryInfo {
  totalGB: number;
  wiredGB: number;
  activeGB: number;
  compressedGB: number;
  freeGB: number;
  swapUsedGB: number;
  pressureState: 'normal' | 'warn' | 'critical';
}

export interface ServerState {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  pid: number | null;
  port: number;
  host: string;
  model: ModelInfo | null;
  gpuLayers: number;
  contextSize: number;
  batchSize: number;
  threads: number;
  startedAt: string | null;
  requestCount: number;
  tokensGenerated: number;
  lastTps: number;
  lastTtftMs: number;
}

export interface ServerLog {
  id: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'info' | 'warn' | 'error' | 'request';
  message: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpointUrl: string;
  region: string;
  isConfigured: boolean;
  demoMode: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  tps?: number;
  ttftMs?: number;
}
