# ModelDock: Cloudflare R2 to RAM Local LLM Runner for macOS

ModelDock is an open-source developer toolchain and companion workspace that streams GGUF models directly from Cloudflare R2 into volatile macOS RAM-disks (`hdiutil ram://`), orchestrates local `llama.cpp` inference servers, and protects hardware from persistent SSD write wear.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **macOS Virtual Memory & Swap Transparency**:
> ModelDock mounts temporary RAM-disks via native macOS kernel tools (`hdiutil attach -nomount ram://<sectors>` formatted as APFS or HFS+). While this guarantees that files are never written to disk paths, macOS virtual memory swap (`vm_compressor` / swapfile) can page out inactive anonymous memory under extreme system pressure. ModelDock strictly guards against this by calculating `available_physical_ram - (model_file_size + context_kv_cache_headroom)` before mounting and aborts with clear error codes if pressure exceeds safe thresholds.
>
> **Deliverables Synthesis**:
> 1. **Complete Python CLI & Repo Scaffolding**: Exportable, modular codebase (`src/modeldock/cli.py`, `r2.py`, `ramdisk.py`, `runner.py`, `models.py`, `config.py`), pytest test suites, `pyproject.toml`, Homebrew Formula (`modeldock.rb`), and clear documentation.
> 2. **Interactive Developer Workspace UI**: An in-browser local manager for live RAM allocation monitoring, R2 bucket credential testing, model catalog explorer, llama.cpp process health prober, built-in OpenAI API playground (`/v1/chat/completions`), and one-click GitHub repo exporter.

---

### 1. Overview & Core Concept

- **What It Does**: Automates the lifecycle of large language models on macOS: authenticates with Cloudflare R2 (S3-compatible API), calculates RAM capacity, creates an in-memory RAM-disk, streams GGUF weights directly into memory with SHA-256 verification, launches `llama.cpp` (`llama-server`) with Metal acceleration (`-ngl 99`), and safely unmounts/purges RAM when finished.
- **Target Audience**: AI engineers, researchers, and developers working on Apple Silicon Macs (M1/M2/M3/M4) who want to test dozens of open-source GGUFs (Qwen, Llama 3, Mistral, Gemma, DeepSeek) without burning through expensive Mac SSD write cycles or filling internal storage.
- **Key Value**: Zero permanent SSD wear for transient model runs, rapid memory reclamation, and instant OpenAI-compatible local endpoints for client apps like Cursor, Open WebUI, Continue, and LangChain.

---

### 2. User Experience & Visual Design

Following the **Universal Frontend Design Constitution** and **SaaS / Developer Dashboard** specifications:

- **Aesthetic Direction**: Utilitarian, dark-mode developer console inspired by macOS Instruments and terminal utilities. Minimalist slate-900 background (`#0B0F17`), crisp hairline borders (`border-slate-800`), muted typography, and purposeful status accents.
- **Top Bar Contract**:
  - *Zone 1 (Brand)*: `ModelDock` (display typography, single-line text).
  - *Zone 2 (Nav Links)*: `Catalog & R2` · `RAM Manager` · `llama.cpp Runner` · `API Playground` · `Repository Files`.
  - *Zone 3 (Action)*: Primary action button `Export Repo Archive`.
- **Primary Views**:
  1. **RAM-Disk & System Memory Monitor**: Real-time visualizer of Mac unified memory (Total, Active, Free, Compressed, and Allocated RAM-Disk sectors). Visualizes the memory headroom before loading a model.
  2. **R2 Model Catalog**: Table and grid of configured models in Cloudflare R2 buckets with sizes, quantization levels (Q4_K_M, Q8_0, BF16), context limits, and one-click `Load into RAM` action.
  3. **llama.cpp Process Controller**: Server port configuration, GPU Metal offload layers (`--n-gpu-layers`), context length (`-c`), batch size, live stdout/stderr log stream, health check heartbeat, and clean SIGTERM shutdown.
  4. **OpenAI-Compatible Test Playground**: Interactive prompt runner connecting to `http://localhost:8080/v1/chat/completions` with streaming tokens, latency tracking (TTFT, tokens/sec), and cURL copy snippets.
  5. **CLI & Repository Inspector**: Interactive explorer of all production repository files (`cli.py`, `ramdisk.py`, `r2.py`, etc.) with syntax-highlighted code viewer and copy/download controls.

---

### 3. Key Product Decisions & Trade-Offs

- **RAM-Disk Allocation via Native macOS APIs**:
  - *Chosen Approach*: Shell orchestrator using `hdiutil attach -nomount ram://<sectors>` followed by `diskutil apfs create <dev> <name>`.
  - *Why*: True kernel-level memory disk without third-party kernel extensions or drivers. Sector formula: $\text{sectors} = \lceil (\text{size in MB} \times 1024 \times 1024) / 512 \rceil$.
  - *Fallback/Recovery*: Automatic signal handlers (`SIGINT`, `SIGTERM`, `atexit`) that run `hdiutil detach` to guarantee memory is never leaked if the process crashes.
- **Direct S3-Compatible Streaming**:
  - *Chosen Approach*: Python `boto3` / `botocore` streaming chunks with real-time `tqdm` progress into the mounted RAM directory, calculating sha256 hashes on the fly.
  - *Why*: Cloudflare R2 provides zero egress fees, making frequent downloading of 2GB–30GB models economically viable.
- **Decoupled llama.cpp Execution**:
  - *Chosen Approach*: Spawns the official standalone `llama-server` binary with `--model /Volumes/RAMDisk/model.gguf --port 8080 --host 127.0.0.1`.
  - *Why*: Avoids fragile Python C-bindings (`llama-cpp-python` compilation headaches on Apple Silicon) and lets developers update llama.cpp independently via `brew install llama.cpp`.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      ModelDock                         │
│  CLI (Typer/Rich) & Developer Companion Console        │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  R2 Adapter  │     │ RAM Manager  │     │ llama Runner │
│ (boto3 / S3) │     │  (hdiutil)   │     │ (subprocess) │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Streams GGUF       │ Mounts /Volumes/   │ Launches
       ▼                    ▼ RAMDisk            ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│Cloudflare R2 │────▶│ macOS RAM    │────▶│ Local Metal  │
│Bucket        │     │ (Zero SSD)   │     │ llama-server │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                                          :8080/v1/chat
                                     (Cursor / Apps / Web)
```

- **Data Models**:
  - `ModelEntry`: ID, name, family, parameter size, quantization, GGUF file key, bucket, file size bytes, SHA-256 hash, required context RAM.
  - `RAMDiskState`: Device node (`/dev/diskX`), mount point (`/Volumes/ModelDockRAM`), allocated MB, free MB, status (`unallocated`, `mounting`, `mounted`, `unmounting`).
  - `ServerProcessState`: PID, port, host, status (`stopped`, `starting`, `ready`, `error`), tokens/sec, active model.
  - `R2Credentials`: Account ID, Access Key ID, Secret Access Key, Bucket Name, Public or S3 endpoint URL.
- **Repository Structure Provided**:
  - `src/modeldock/__init__.py`: Package metadata and exports.
  - `src/modeldock/cli.py`: Typer CLI commands (`configure`, `list`, `load`, `serve`, `unload`, `status`, `purge`).
  - `src/modeldock/config.py`: Local config manager (`~/.modeldock/config.json`).
  - `src/modeldock/r2.py`: Boto3 S3 adapter for Cloudflare R2 listing and streaming downloads with chunked checksums.
  - `src/modeldock/ramdisk.py`: Robust macOS `hdiutil` / `diskutil` lifecycle with emergency detach traps.
  - `src/modeldock/models.py`: Model registry parser and GGUF header inspector.
  - `src/modeldock/runner.py`: Subprocess manager for `llama-server` with health polling and graceful SIGTERM.
  - `tests/test_ramdisk.py`, `tests/test_r2.py`, `tests/test_runner.py`: Pytest test suite with mocked disk and S3 responses.
  - `pyproject.toml`: Modern Poetry/Hatchling packaging configuration.
  - `Formula/modeldock.rb`: Official Homebrew formula template.
  - `README.md` & `LICENSE`: Comprehensive MIT documentation, architecture diagrams, and quickstart commands.
