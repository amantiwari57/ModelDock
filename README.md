# ModelDock 🚀

> **Zero-SSD Local LLM Manager for macOS**  
> Stream GGUF models directly from **Cloudflare R2** into volatile **macOS RAM-disks** and serve them locally with **`llama.cpp`** (Apple Silicon Metal GPU acceleration) — with **zero permanent flash SSD write wear**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS%20Apple%20Silicon-black.svg)]()
[![Backend: llama.cpp](https://img.shields.io/badge/Engine-llama.cpp%20Metal-green.svg)]()
[![Storage: Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare%20R2%20(S3)-orange.svg)]()

---

## 💡 Why ModelDock?

Modern Apple Silicon Macs (M1/M2/M3/M4) have blisteringly fast unified memory (up to 400 GB/s bandwidth) and high-performance Metal GPU cores. However:

1. **Soldered, Finite SSD Storage**: Testing modern 3B–30B parameter open-weights models (Qwen, Llama, DeepSeek, Mistral, Gemma) eats up hundreds of gigabytes of non-upgradeable Mac SSD capacity.
2. **Flash NAND Endurance**: Continuously downloading, unpacking, and deleting large multi-gigabyte models burns through SSD write cycles over time.
3. **Cloudflare R2 Has Zero Egress Fees**: Unlike AWS S3 or GCP Cloud Storage, Cloudflare R2 charges **$0.00 for outbound data egress**, making high-throughput, on-demand streaming of model weights economically practical.

**ModelDock** makes this workflow one-command simple: it attaches an in-memory macOS RAM-disk via `hdiutil`, streams GGUF weights directly into volatile memory with real-time SHA-256 verification, boots `llama.cpp` (`llama-server`) with full Metal GPU offloading, and purges the RAM-disk instantly when done.

---

## 🏛️ System Architecture

```text
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
       │ 8MB Chunks Stream  │ Mounts /Volumes/   │ Launches
       ▼                    ▼ ModelDockRAM       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│Cloudflare R2 │────▶│ macOS RAM    │────▶│ Local Metal  │
│Model Bucket  │     │ (Zero SSD)   │     │ llama-server │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                                        http://127.0.0.1:8080/v1
                                  (Cursor / Continue / Python / LangChain)
```

---

## ⚡ Quickstart

### 1. Installation

#### Via Homebrew (Recommended on macOS)
```bash
brew tap modeldock/tap
brew install modeldock
```

#### Via pipx / Python 3.10+
```bash
pipx install git+https://github.com/modeldock/modeldock.git
```

#### Dependencies
ModelDock requires the official `llama.cpp` binary with Apple Metal support:
```bash
brew install llama.cpp
```

---

### 2. Configure Cloudflare R2
Configure your R2 credentials (stored securely in `~/.modeldock/config.json`):
```bash
modeldock configure
# Cloudflare Account ID: your_account_id
# R2 Access Key ID: your_access_key
# R2 Secret Access Key: your_secret_key
# R2 Bucket Name: your-gguf-models
```

---

### 3. Browse Available Models
Query models from your configured R2 bucket as well as predefined catalog entries:
```bash
modeldock list
```

Sample output:
```text
                          ModelDock Model Catalog
┏━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━━━━━━┓
┃ ID             ┃ Model Name                  ┃ Size    ┃ Quant  ┃ Context  ┃ Estimated RAM ┃
┡━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━━━━━━┩
│ qwen-3b        │ Qwen 2.5 3B Instruct        │ 2.15 GB │ Q4_K_M │ 8192 tok │ ~4.5 GB       │
│ llama-3.2-3b   │ Llama 3.2 3B Instruct       │ 2.02 GB │ Q4_K_M │ 8192 tok │ ~4.2 GB       │
│ deepseek-r1-7b │ DeepSeek R1 Distill Qwen 7B │ 4.68 GB │ Q4_K_M │ 8192 tok │ ~8.0 GB       │
│ mistral-7b     │ Mistral 7B Instruct v0.3    │ 4.37 GB │ Q4_K_M │ 8192 tok │ ~7.5 GB       │
│ gemma-2-2b     │ Gemma 2 2B Instruct         │ 2.78 GB │ Q8_0   │ 8192 tok │ ~5.0 GB       │
│ phi-4-mini     │ Phi-4 Mini 3.8B Instruct    │ 2.49 GB │ Q4_K_M │ 16384 tok│ ~5.2 GB       │
└────────────────┴─────────────────────────────┴─────────┴────────┴──────────┴───────────────┘
```

---

### 4. Load Model into Volatile RAM
Allocates the required APFS RAM-disk in unified memory, streams the GGUF weights directly into memory, and verifies integrity:
```bash
modeldock load qwen-3b
```
*(Sector formula: $\text{sectors} = \lceil (\text{size in MB} \times 1024 \times 1024) / 512 \rceil$)*

---

### 5. Launch Local Inference Server
Starts `llama-server` reading directly from `/Volumes/ModelDockRAM/`:
```bash
modeldock serve qwen-3b --port 8080 --gpu-layers 99
```

The server provides a standard, OpenAI-compatible endpoint on:
```
http://127.0.0.1:8080/v1
```

---

### 6. Inspect Status & Memory Pressure
```bash
modeldock status
```

---

### 7. Stop Server & Purge RAM
Unmounts the RAM-disk, immediately reclaiming 100% of the allocated memory back to macOS:
```bash
modeldock unload qwen-3b
```
**Result**: 0 bytes written to internal SSD flash.

---

## 🧠 Engineering Reality: Virtual Memory & Swap Paging

A critical engineering truth when working with macOS:

> **Virtual Memory Swap Transparency**:  
> While ModelDock prevents files from ever touching the SSD filesystem paths, macOS uses dynamic kernel memory paging (`vm_compressor` and swapfiles). Under extreme system memory pressure, the kernel can page out inactive anonymous memory to swap.

To ensure **true zero-SSD wear**, ModelDock enforces strict pre-flight safeguards:

1. **Active Memory Probing**: Checks `sysctl hw.memsize` and `vm_stat` page states (Free + Inactive).
2. **Context KV Cache Headroom**: Calculates model file size + KV cache allocation + Metal runtime graph buffers:
   $$\text{RAM}_{\text{needed}} = \text{Model Size} + \left(\frac{\text{Context Size}}{1024} \times 0.18\text{ GB}\right) + 0.85\text{ GB (Metal)}$$
3. **Hard Abort on Pressure**: If available physical RAM does not satisfy the formula, ModelDock aborts with a clear warning rather than allowing macOS to thrash swap.
4. **4.0 GB Headroom Warning**: The companion console displays a visual warning indicator whenever free memory drops below 4.0 GB, prompting the user to unload idle models.
5. **Crash Safety Traps**: Native signal handlers (`SIGINT`, `SIGTERM`, and `atexit`) guarantee that `hdiutil detach` is executed even if a script is killed unexpectedly.

---

## 🔌 Connecting to Your Tools

Because ModelDock provides a standard OpenAI-compatible API (`/v1/chat/completions`), any LLM client connects seamlessly:

### Cursor IDE
Add to Cursor Settings or Custom OpenAI Provider:
```json
{
  "openai.apiBase": "http://127.0.0.1:8080/v1",
  "openai.apiKey": "local-key",
  "openai.model": "qwen-3b"
}
```

### Continue.dev (`~/.continue/config.json`)
```json
{
  "models": [
    {
      "title": "ModelDock Qwen 3B",
      "provider": "openai",
      "model": "qwen-3b",
      "apiBase": "http://127.0.0.1:8080/v1",
      "apiKey": "local"
    }
  ]
}
```

### Python (`openai` SDK)
```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8080/v1", api_key="local")

stream = client.chat.completions.create(
    model="qwen-3b",
    messages=[{"role": "user", "content": "Explain RAM-disks on macOS."}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### cURL
```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-3b",
    "messages": [{"role": "user", "content": "Hello local model!"}]
  }'
```

---

## 🗂️ Project Repository Structure

```text
modeldock/
├── src/modeldock/
│   ├── __init__.py      # Package metadata & exports
│   ├── cli.py           # Typer CLI application & Rich tables
│   ├── config.py        # Configuration manager (~/.modeldock/config.json)
│   ├── r2.py            # Boto3 S3 adapter for Cloudflare R2 streaming
│   ├── ramdisk.py       # macOS hdiutil/diskutil APFS volatile RAM-disk lifecycle
│   ├── models.py        # GGUF catalog registry & KV cache RAM estimator
│   └── runner.py        # llama-server subprocess runner & health probes
├── tests/
│   ├── test_ramdisk.py  # Pytest sector math & memory pressure guards
│   ├── test_r2.py       # Pytest R2 client & GGUF object filtering
│   └── test_runner.py   # Pytest Metal layer arguments & process supervisor
├── Formula/
│   └── modeldock.rb     # Homebrew tap formula
├── scripts/
│   └── install.sh       # One-line curl installer for macOS
├── pyproject.toml       # PEP 621 / Hatchling build packaging
├── LICENSE              # MIT License
└── README.md            # Comprehensive documentation
```

---

## 🧪 Running Pytest Tests

```bash
cd modeldock
pip install -e ".[dev]"
pytest -v
```

---

## 🖥️ Companion Developer Console

This repository also includes a full-featured web companion workspace built with React, Vite, and Tailwind CSS:

- **RAM Visualizer**: Real-time Apple Silicon unified memory bar with dynamic context slider and **`< 4.0 GB` free memory warning indicator**.
- **R2 Model Registry**: Searchable catalog with direct **"Load into RAM"** action and SHA-256 verification.
- **llama.cpp Supervisor**: Port and GPU layer controls with live stdout/stderr log feed.
- **API Playground**: Live chat tester measuring Time-To-First-Token (TTFT) and throughput (tokens/sec).
- **CLI Terminal**: Interactive in-browser macOS shell emulator.
- **1-Click Repo Exporter**: Download the complete, ready-to-publish GitHub archive (`modeldock-open-source.zip`) with one click.

---

## 📄 License

ModelDock is released under the **[MIT License](LICENSE)**. Open source and free for developers worldwide.
