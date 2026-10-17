# ModelDock

> **Zero-SSD local LLM manager for macOS**  
> Store GGUF weights in Cloudflare R2 · Stream directly into volatile RAM-disk · Run local \`llama.cpp\` Metal inference with zero permanent disk writes.

---

## Why ModelDock?

Modern Apple Silicon Macs (M1/M2/M3/M4) have fast unified memory and incredible Metal compute, but:
1. **SSD storage is soldered and finite**: Testing dozens of 4GB–30GB GGUF models quickly burns gigabytes of internal storage.
2. **SSD write endurance matters**: Continuously downloading, unpacking, and deleting large models contributes to NAND flash wear.
3. **Cloudflare R2 has zero egress fees**: Cloud storage is cheap, fast, and free to download as often as you want.

**ModelDock** bridges this gap: it provisions an in-memory macOS RAM-disk (\`hdiutil attach -nomount ram://\`), streams GGUF model weights from private Cloudflare R2 buckets directly into volatile RAM, executes \`llama-server\` with Metal GPU acceleration, and unmounts the RAM-disk when you're done.

---

## Engineering Reality: Virtual Memory & Swap

> **Note on macOS Memory Management**:  
> While ModelDock ensures model files are never created on your SSD, macOS uses dynamic virtual memory paging. Under extreme memory pressure, the macOS kernel (\`vm_compressor\`) may page dirty anonymous memory to the swap file.  
>  
> To protect against this, ModelDock:
> - Checks \`vm_stat\` and \`hw.memsize\` before allocating.
> - Calculates **Model Size + KV Cache Headroom (2GB–4GB)**.
> - Strictly aborts if your Mac does not have sufficient physical RAM available.

---

## Quickstart

### 1. Install via Homebrew
\`\`\`bash
brew tap modeldock/tap
brew install modeldock
\`\`\`

### 2. Configure Cloudflare R2
\`\`\`bash
modeldock configure
# Cloudflare Account ID: your_account_id
# R2 Access Key ID: your_access_key
# R2 Secret Access Key: your_secret_key
# R2 Bucket Name: your-llm-models
\`\`\`

### 3. List Available Models
\`\`\`bash
modeldock list
\`\`\`

### 4. Load Model into Volatile RAM
\`\`\`bash
modeldock load qwen-3b
\`\`\`

### 5. Launch llama.cpp Metal Server
\`\`\`bash
modeldock serve qwen-3b --port 8080
\`\`\`

Connect any OpenAI-compatible client (Cursor, Continue, Open WebUI, Python, LangChain) to:
\`\`\`
http://localhost:8080/v1
\`\`\`

### 6. Stop Server and Purge RAM
\`\`\`bash
modeldock unload qwen-3b
\`\`\`
All RAM is instantly released to macOS with zero leftover files on your SSD.

---

## Repository Structure

\`\`\`text
modeldock/
├── src/modeldock/
│   ├── cli.py        # Typer CLI application
│   ├── config.py     # Local credentials & preferences
│   ├── r2.py         # S3-compatible Cloudflare R2 adapter
│   ├── ramdisk.py    # macOS hdiutil/diskutil RAM manager
│   ├── models.py     # GGUF catalog & KV cache memory estimator
│   └── runner.py     # llama.cpp process supervisor
├── tests/            # Pytest suite with mocks
├── Formula/          # Homebrew tap formula
├── scripts/          # One-line installer
├── pyproject.toml    # Modern packaging configuration
└── LICENSE           # MIT License
\`\`\`

---

## License

MIT © ModelDock Authors.
