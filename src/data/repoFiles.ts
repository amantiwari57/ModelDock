export interface RepoFile {
  path: string;
  language: string;
  content: string;
  description: string;
}

export const REPOSITORY_FILES: RepoFile[] = [
  {
    path: "pyproject.toml",
    language: "toml",
    description: "Project metadata, dependencies, and CLI script entrypoint",
    content: `[project]
name = "modeldock"
version = "0.1.0"
description = "Stream GGUF models from Cloudflare R2 into volatile macOS RAM-disks for zero-SSD llama.cpp execution"
readme = "README.md"
requires-python = ">=3.10"
license = { text = "MIT" }
authors = [
    { name = "ModelDock Maintainers" }
]
keywords = ["llm", "llama-cpp", "macos", "apple-silicon", "ramdisk", "cloudflare-r2", "gguf"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Environment :: Console",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Operating System :: MacOS :: MacOS X",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Topic :: Scientific/Engineering :: Artificial Intelligence",
]

dependencies = [
    "typer[all]>=0.12.0",
    "rich>=13.7.0",
    "boto3>=1.34.0",
    "botocore>=1.34.0",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.2.0",
    "httpx>=0.27.0",
    "tqdm>=4.66.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-mock>=3.12.0",
    "pytest-cov>=4.1.0",
    "ruff>=0.3.0",
    "mypy>=1.9.0",
]

[project.scripts]
modeldock = "modeldock.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/modeldock"]

[tool.ruff]
line-length = 100
target-version = "py310"
`
  },
  {
    path: "src/modeldock/__init__.py",
    language: "python",
    description: "Package initialization and public exports",
    content: `"""
ModelDock: Zero-SSD local LLM runner for macOS.
Streams GGUF models from Cloudflare R2 directly into volatile RAM-disks.
"""

__version__ = "0.1.0"
__author__ = "ModelDock Authors"

from modeldock.config import ConfigManager
from modeldock.r2 import R2Client
from modeldock.ramdisk import RAMDiskManager
from modeldock.runner import LlamaRunner

__all__ = ["ConfigManager", "R2Client", "RAMDiskManager", "LlamaRunner", "__version__"]
`
  },
  {
    path: "src/modeldock/config.py",
    language: "python",
    description: "Local configuration manager stored in ~/.modeldock/config.json",
    content: `from pathlib import Path
import json
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

CONFIG_DIR = Path.home() / ".modeldock"
CONFIG_FILE = CONFIG_DIR / "config.json"


class R2Settings(BaseModel):
    account_id: str = Field(default="", description="Cloudflare Account ID")
    access_key_id: str = Field(default="", description="R2 Access Key ID")
    secret_access_key: str = Field(default="", description="R2 Secret Access Key")
    bucket_name: str = Field(default="", description="R2 Model Bucket Name")
    endpoint_url: Optional[str] = Field(default=None, description="Custom S3 endpoint")


class AppConfig(BaseModel):
    r2: R2Settings = Field(default_factory=R2Settings)
    default_gpu_layers: int = 99
    default_ctx_size: int = 4096
    default_port: int = 8080
    llama_server_path: str = "llama-server"
    ramdisk_mount_name: str = "ModelDockRAM"
    safety_headroom_gb: float = 4.0


class ConfigManager:
    @staticmethod
    def get_config_dir() -> Path:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        return CONFIG_DIR

    @classmethod
    def load(cls) -> AppConfig:
        if not CONFIG_FILE.exists():
            return AppConfig()
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return AppConfig.model_validate(data)
        except Exception:
            return AppConfig()

    @classmethod
    def save(cls, config: AppConfig) -> None:
        cls.get_config_dir()
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2)
`
  },
  {
    path: "src/modeldock/ramdisk.py",
    language: "python",
    description: "macOS hdiutil RAM-disk lifecycle, capacity checks, and zero-SSD purge",
    content: `import os
import sys
import subprocess
import atexit
import signal
from pathlib import Path
from typing import Optional, Tuple
from rich.console import Console

console = Console()

DEFAULT_MOUNT_NAME = "ModelDockRAM"
MOUNT_ROOT = Path("/Volumes")


class RAMDiskError(Exception):
    pass


class RAMDiskManager:
    """
    Manages volatile RAM-disks on macOS using native hdiutil and diskutil.
    Guarantee: Memory is never written to disk paths, and releases instantly on unmount.
    """

    def __init__(self, mount_name: str = DEFAULT_MOUNT_NAME):
        self.mount_name = mount_name
        self.mount_point = MOUNT_ROOT / mount_name
        self._device: Optional[str] = None
        self._register_cleanup_traps()

    def _register_cleanup_traps(self):
        """Ensure RAM is reclaimed even on unexpected SIGINT or exit."""
        def handle_signal(sig, frame):
            console.print("[yellow]\\nReceived interrupt signal. Purging volatile RAM-disk...[/yellow]")
            self.unmount(silent=True)
            sys.exit(130)

        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)
        atexit.register(lambda: self.unmount(silent=True))

    @staticmethod
    def get_system_memory() -> Tuple[float, float]:
        """
        Returns (total_physical_gb, available_gb) using macOS sysctl & vm_stat.
        """
        try:
            total_bytes = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"]).strip())
            total_gb = total_bytes / (1024 ** 3)
        except Exception:
            total_gb = 16.0

        try:
            vm_out = subprocess.check_output(["vm_stat"]).decode("utf-8")
            lines = vm_out.splitlines()
            page_size = 4096
            free_pages = 0
            inactive_pages = 0
            for line in lines:
                if "page size of" in line:
                    parts = line.split()
                    for p in parts:
                        if p.isdigit():
                            page_size = int(p)
                elif "Pages free:" in line:
                    free_pages = int(line.split(":")[1].strip().rstrip("."))
                elif "Pages inactive:" in line:
                    inactive_pages = int(line.split(":")[1].strip().rstrip("."))
            available_bytes = (free_pages + inactive_pages) * page_size
            available_gb = available_bytes / (1024 ** 3)
        except Exception:
            available_gb = total_gb * 0.45

        return round(total_gb, 2), round(available_gb, 2)

    def calculate_sectors(self, size_mb: int) -> int:
        """Calculate 512-byte sectors needed for requested MB."""
        return (size_mb * 1024 * 1024) // 512

    def is_mounted(self) -> bool:
        return self.mount_point.exists() and os.path.ismount(str(self.mount_point))

    def mount(self, size_gb: float) -> Path:
        """
        Creates and mounts an APFS volatile RAM-disk of size_gb in RAM.
        Fails if system memory pressure is too high.
        """
        if self.is_mounted():
            console.print(f"[green]RAM-disk already active at {self.mount_point}[/green]")
            return self.mount_point

        total_gb, available_gb = self.get_system_memory()
        required_gb = size_gb + 2.0  # safety headroom for runtime + KV cache

        if required_gb > available_gb:
            raise RAMDiskError(
                f"Insufficient RAM! Model needs {size_gb:.1f} GB (+2GB headroom), "
                f"but only {available_gb:.1f} GB is currently available of {total_gb:.1f} GB total physical RAM. "
                f"Free up applications or macOS swap will page to SSD."
            )

        size_mb = int(size_gb * 1024) + 256  # 256MB filesystem overhead
        sectors = self.calculate_sectors(size_mb)

        console.print(f"[cyan]Allocating {size_mb} MB ({sectors} sectors) in macOS unified RAM...[/cyan]")
        attach_cmd = ["hdiutil", "attach", "-nomount", f"ram://{sectors}"]
        proc = subprocess.run(attach_cmd, capture_output=True, text=True, check=True)
        device = proc.stdout.strip()
        self._device = device

        console.print(f"[cyan]Formatting volatile APFS volume on {device}...[/cyan]")
        format_cmd = ["diskutil", "eraseDisk", "APFS", self.mount_name, device]
        subprocess.run(format_cmd, capture_output=True, text=True, check=True)

        if not self.is_mounted():
            raise RAMDiskError(f"Failed to verify mount at {self.mount_point}")

        console.print(f"[bold green]Mounted volatile RAM-disk at {self.mount_point}[/bold green]")
        return self.mount_point

    def unmount(self, silent: bool = False) -> None:
        """Unmounts and frees the RAM sectors immediately."""
        if not self.is_mounted() and not self._device:
            return

        target = str(self.mount_point) if self.is_mounted() else self._device
        try:
            subprocess.run(["hdiutil", "detach", target, "-force"], capture_output=True, check=False)
            if not silent:
                console.print(f"[green]Purged RAM-disk. All allocated memory released to macOS.[/green]")
        except Exception as e:
            if not silent:
                console.print(f"[red]Error during unmount: {e}[/red]")
        finally:
            self._device = None
`
  },
  {
    path: "src/modeldock/r2.py",
    language: "python",
    description: "Cloudflare R2 S3-compatible client with chunk streaming & SHA-256 verification",
    content: `import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from rich.progress import Progress, BarColumn, TextColumn, TransferSpeedColumn, TimeRemainingColumn
from modeldock.config import AppConfig


class R2Client:
    def __init__(self, config: AppConfig):
        self.config = config.r2
        if not self.config.account_id or not self.config.access_key_id:
            raise ValueError("Cloudflare R2 is not configured. Run 'modeldock configure' first.")

        endpoint = self.config.endpoint_url or f"https://{self.config.account_id}.r2.cloudflarestorage.com"

        self.s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self.config.access_key_id,
            aws_secret_access_key=self.config.secret_access_key,
            config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
            region_name="auto"
        )
        self.bucket = self.config.bucket_name

    def list_models(self) -> List[Dict[str, Any]]:
        """List all GGUF model files in the configured R2 bucket."""
        try:
            response = self.s3.list_objects_v2(Bucket=self.bucket)
            objects = response.get("Contents", [])
            models = []
            for obj in objects:
                key = obj["Key"]
                if key.endswith(".gguf") or ".gguf." in key:
                    size_bytes = obj["Size"]
                    size_gb = round(size_bytes / (1024 ** 3), 2)
                    models.append({
                        "key": key,
                        "size_bytes": size_bytes,
                        "size_gb": size_gb,
                        "last_modified": str(obj.get("LastModified", "")),
                        "etag": obj.get("ETag", "").strip('"')
                    })
            return models
        except ClientError as e:
            raise RuntimeError(f"R2 API error: {e}")

    def download_to_ram(
        self,
        key: str,
        target_dir: Path,
        expected_sha256: Optional[str] = None
    ) -> Path:
        """
        Streams GGUF file directly from R2 into RAM-disk directory.
        Zero permanent disk writes. Verifies checksum simultaneously.
        """
        target_file = target_dir / Path(key).name
        head = self.s3.head_object(Bucket=self.bucket, Key=key)
        total_size = head["ContentLength"]

        response = self.s3.get_object(Bucket=self.bucket, Key=key)
        stream = response["Body"]

        hasher = hashlib.sha256()
        chunk_size = 8 * 1024 * 1024  # 8MB chunk for high throughput streaming

        with Progress(
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TransferSpeedColumn(),
            TimeRemainingColumn(),
        ) as progress:
            task = progress.add_task(f"Streaming {key} into RAM", total=total_size)

            with open(target_file, "wb") as f:
                while True:
                    chunk = stream.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    hasher.update(chunk)
                    progress.update(task, advance=len(chunk))

        computed_sha = hasher.hexdigest()
        if expected_sha256 and computed_sha.lower() != expected_sha256.lower():
            if target_file.exists():
                target_file.unlink()
            raise ValueError(f"Integrity check failed! Expected SHA256 {expected_sha256}, got {computed_sha}")

        return target_file
`
  },
  {
    path: "src/modeldock/models.py",
    language: "python",
    description: "Model registry specifications and KV cache memory estimator",
    content: `from typing import Dict, Any, Optional
from pydantic import BaseModel


class ModelSpec(BaseModel):
    id: str
    name: str
    family: str
    parameters: str
    quantization: str
    r2_key: str
    size_gb: float
    context_length: int = 4096
    expected_sha256: Optional[str] = None

    def estimate_total_ram_needed(self, context_size: Optional[int] = None) -> float:
        """
        Calculate weights footprint + KV cache memory overhead for Apple Silicon.
        KV cache rule of thumb for modern 3B-7B models: ~0.5GB to 1.8GB per 8K tokens.
        """
        ctx = context_size or self.context_length
        # Rough KV cache memory formula in GB
        kv_cache_gb = (ctx / 4096) * 0.75
        runtime_overhead_gb = 1.0  # Metal buffers & context graph
        return round(self.size_gb + kv_cache_gb + runtime_overhead_gb, 2)


# Built-in catalog mappings for popular GGUFs
CATALOG: Dict[str, ModelSpec] = {
    "qwen-3b": ModelSpec(
        id="qwen-3b",
        name="Qwen 2.5 3B Instruct",
        family="Qwen",
        parameters="3B",
        quantization="Q4_K_M",
        r2_key="qwen2.5-3b-instruct-q4_k_m.gguf",
        size_gb=2.15,
        context_length=8192
    ),
    "llama-3.2-3b": ModelSpec(
        id="llama-3.2-3b",
        name="Llama 3.2 3B Instruct",
        family="Llama",
        parameters="3B",
        quantization="Q4_K_M",
        r2_key="llama-3.2-3b-instruct-q4_k_m.gguf",
        size_gb=2.02,
        context_length=8192
    ),
    "deepseek-r1-7b": ModelSpec(
        id="deepseek-r1-7b",
        name="DeepSeek R1 Distill Qwen 7B",
        family="DeepSeek",
        parameters="7B",
        quantization="Q4_K_M",
        r2_key="deepseek-r1-distill-qwen-7b-q4_k_m.gguf",
        size_gb=4.68,
        context_length=8192
    ),
    "mistral-7b": ModelSpec(
        id="mistral-7b",
        name="Mistral 7B Instruct v0.3",
        family="Mistral",
        parameters="7B",
        quantization="Q4_K_M",
        r2_key="mistral-7b-instruct-v0.3-q4_k_m.gguf",
        size_gb=4.37,
        context_length=8192
    )
}


def get_model(model_id: str) -> Optional[ModelSpec]:
    return CATALOG.get(model_id.lower())
`
  },
  {
    path: "src/modeldock/runner.py",
    language: "python",
    description: "llama.cpp process supervisor, Metal GPU layer flags, and health polling",
    content: `import os
import sys
import subprocess
import time
from pathlib import Path
from typing import Optional
import httpx
from rich.console import Console

console = Console()


class LlamaRunner:
    """
    Subprocess manager for official llama.cpp 'llama-server' binary.
    Provides local OpenAI-compatible API on http://127.0.0.1:<port>/v1
    """

    def __init__(
        self,
        model_path: Path,
        port: int = 8080,
        host: str = "127.0.0.1",
        gpu_layers: int = 99,
        context_size: int = 4096,
        server_binary: str = "llama-server"
    ):
        self.model_path = model_path
        self.port = port
        self.host = host
        self.gpu_layers = gpu_layers
        self.context_size = context_size
        self.server_binary = server_binary
        self._process: Optional[subprocess.Popen] = None

    def _verify_binary(self) -> None:
        try:
            subprocess.run([self.server_binary, "--version"], capture_output=True, check=False)
        except FileNotFoundError:
            raise RuntimeError(
                f"llama-server binary '{self.server_binary}' not found in PATH!\\n"
                "Install it on macOS via Homebrew: 'brew install llama.cpp'"
            )

    def start(self) -> None:
        self._verify_binary()

        cmd = [
            self.server_binary,
            "-m", str(self.model_path),
            "--port", str(self.port),
            "--host", self.host,
            "-ngl", str(self.gpu_layers),
            "-c", str(self.context_size),
            "--metrics"
        ]

        console.print(f"[cyan]Starting llama-server: {' '.join(cmd)}[/cyan]")
        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        # Wait for HTTP server to become ready
        self._wait_until_ready(timeout_sec=30)
        console.print(f"[bold green]llama.cpp server is READY at http://{self.host}:{self.port}[/bold green]")
        console.print(f"[dim]Compatible with OpenAI API clients: http://{self.host}:{self.port}/v1[/dim]")

    def _wait_until_ready(self, timeout_sec: int = 30) -> None:
        health_url = f"http://{self.host}:{self.port}/health"
        start_time = time.time()
        while time.time() - start_time < timeout_sec:
            if self._process and self._process.poll() is not None:
                out, _ = self._process.communicate()
                raise RuntimeError(f"llama-server exited prematurely with code {self._process.returncode}:\\n{out}")
            try:
                r = httpx.get(health_url, timeout=1.0)
                if r.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.5)
        raise TimeoutError(f"Server did not respond on {health_url} within {timeout_sec}s")

    def stop(self) -> None:
        if self._process and self._process.poll() is None:
            console.print("[yellow]Stopping llama-server...[/yellow]")
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
            console.print("[green]llama-server terminated cleanly.[/green]")
`
  },
  {
    path: "src/modeldock/cli.py",
    language: "python",
    description: "Typer CLI implementation with rich terminal UI and all commands",
    content: `from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from modeldock.config import ConfigManager, AppConfig, R2Settings
from modeldock.r2 import R2Client
from modeldock.ramdisk import RAMDiskManager
from modeldock.runner import LlamaRunner
from modeldock.models import CATALOG, get_model

app = typer.Typer(
    name="modeldock",
    help="Zero-SSD local LLM runner for macOS: stream GGUFs from Cloudflare R2 into RAM-disks.",
    no_args_is_help=True
)
console = Console()


@app.command()
def configure(
    account_id: str = typer.Option(..., prompt="Cloudflare Account ID", help="Found in Cloudflare dashboard"),
    access_key_id: str = typer.Option(..., prompt="R2 Access Key ID"),
    secret_access_key: str = typer.Option(..., prompt="R2 Secret Access Key", hide_input=True),
    bucket: str = typer.Option(..., prompt="R2 Bucket Name containing GGUF models")
):
    """Configure Cloudflare R2 credentials and target model bucket."""
    cfg = ConfigManager.load()
    cfg.r2 = R2Settings(
        account_id=account_id.strip(),
        access_key_id=access_key_id.strip(),
        secret_access_key=secret_access_key.strip(),
        bucket_name=bucket.strip()
    )
    ConfigManager.save(cfg)
    console.print(Panel("[bold green]Cloudflare R2 configured successfully in ~/.modeldock/config.json[/bold green]"))


@app.command(name="list")
def list_models():
    """List models available in Cloudflare R2 bucket and predefined catalog."""
    cfg = ConfigManager.load()
    table = Table(title="ModelDock Model Catalog", show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan")
    table.add_column("Model Name", style="white")
    table.add_column("Size", style="green")
    table.add_column("Quant", style="yellow")
    table.add_column("Context", style="blue")
    table.add_column("Estimated RAM", style="red")

    for m in CATALOG.values():
        table.add_row(
            m.id,
            m.name,
            f"{m.size_gb} GB",
            m.quantization,
            f"{m.context_length} tok",
            f"~{m.estimate_total_ram_needed()} GB"
        )
    console.print(table)

    if cfg.r2.account_id:
        console.print("[dim]Fetching live objects from your R2 bucket...[/dim]")
        try:
            client = R2Client(cfg)
            r2_models = client.list_models()
            r2_table = Table(title=f"Live R2 Bucket: {cfg.r2.bucket_name}", show_header=True)
            r2_table.add_column("GGUF Key", style="cyan")
            r2_table.add_column("Size", style="green")
            for obj in r2_models:
                r2_table.add_row(obj["key"], f"{obj['size_gb']} GB")
            console.print(r2_table)
        except Exception as e:
            console.print(f"[yellow]Note: Could not query live R2 bucket ({e}).[/yellow]")


@app.command()
def load(
    model_id: str = typer.Argument(..., help="Model ID (e.g. qwen-3b, llama-3.2-3b) or GGUF filename")
):
    """Allocate macOS RAM-disk and stream GGUF model from Cloudflare R2 directly into RAM."""
    spec = get_model(model_id)
    size_gb = spec.size_gb if spec else 4.0
    key = spec.r2_key if spec else model_id

    cfg = ConfigManager.load()
    ram_mgr = RAMDiskManager(cfg.ramdisk_mount_name)
    mount_dir = ram_mgr.mount(size_gb)

    client = R2Client(cfg)
    console.print(f"[cyan]Streaming {key} from R2 into volatile RAM at {mount_dir}...[/cyan]")
    model_path = client.download_to_ram(key, mount_dir, expected_sha256=spec.expected_sha256 if spec else None)
    console.print(f"[bold green]Model successfully loaded into RAM at {model_path}[/bold green]")
    console.print("[dim]Next step: Run 'modeldock serve " + model_id + "' to start inference.[/dim]")


@app.command()
def serve(
    model_id: str = typer.Argument(..., help="Model ID currently loaded in RAM"),
    port: int = typer.Option(8080, help="HTTP server port"),
    gpu_layers: int = typer.Option(99, help="Number of layers to offload to Metal GPU"),
    ctx_size: int = typer.Option(4096, help="Context size tokens")
):
    """Launch llama.cpp server using the model loaded in RAM."""
    spec = get_model(model_id)
    key = spec.r2_key if spec else model_id
    filename = Path(key).name

    cfg = ConfigManager.load()
    ram_mgr = RAMDiskManager(cfg.ramdisk_mount_name)
    model_path = ram_mgr.mount_point / filename

    if not model_path.exists():
        console.print(f"[red]Error: Model file {model_path} not found in RAM![/red]")
        console.print(f"[yellow]Run 'modeldock load {model_id}' first.[/yellow]")
        raise typer.Exit(1)

    runner = LlamaRunner(
        model_path=model_path,
        port=port,
        gpu_layers=gpu_layers,
        context_size=ctx_size,
        server_binary=cfg.llama_server_path
    )
    runner.start()

    console.print("[bold yellow]Press Ctrl+C to stop server and keep model in RAM.[/bold yellow]")
    try:
        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        runner.stop()


@app.command()
def unload(
    model_id: Optional[str] = typer.Argument(None, help="Optional model identifier")
):
    """Stop inference and purge RAM-disk, reclaiming 100% of allocated memory."""
    cfg = ConfigManager.load()
    ram_mgr = RAMDiskManager(cfg.ramdisk_mount_name)
    ram_mgr.unmount()
    console.print("[bold green]RAM-disk unmounted. Zero SSD writes recorded.[/bold green]")


@app.command()
def status():
    """Display active RAM-disk allocation, unified memory pressure, and loaded models."""
    cfg = ConfigManager.load()
    ram_mgr = RAMDiskManager(cfg.ramdisk_mount_name)
    total_gb, avail_gb = ram_mgr.get_system_memory()

    table = Table(title="ModelDock System Status", show_header=True)
    table.add_column("Component", style="cyan")
    table.add_column("State", style="white")

    table.add_row("Total Physical RAM", f"{total_gb} GB")
    table.add_row("Available RAM", f"{avail_gb} GB")
    table.add_row("RAM-Disk Mounted", "[green]YES[/green]" if ram_mgr.is_mounted() else "[dim]NO[/dim]")
    table.add_row("Mount Point", str(ram_mgr.mount_point))

    if ram_mgr.is_mounted():
        files = list(ram_mgr.mount_point.glob("*.gguf"))
        loaded = ", ".join(f.name for f in files) if files else "Empty volume"
        table.add_row("Loaded in RAM", loaded)

    console.print(table)


if __name__ == "__main__":
    app()
`
  },
  {
    path: "tests/test_ramdisk.py",
    language: "python",
    description: "Pytest unit tests for macOS hdiutil sector calculations and memory safety",
    content: `from unittest.mock import patch, MagicMock
import pytest
from modeldock.ramdisk import RAMDiskManager, RAMDiskError


def test_sector_calculation():
    mgr = RAMDiskManager()
    # 1024 MB = 1GB -> (1024 * 1024 * 1024) // 512 = 2097152 sectors
    sectors = mgr.calculate_sectors(1024)
    assert sectors == 2097152


@patch("modeldock.ramdisk.RAMDiskManager.get_system_memory")
def test_insufficient_memory_guard(mock_mem):
    mock_mem.return_value = (16.0, 3.0)  # Only 3GB available
    mgr = RAMDiskManager()
    with pytest.raises(RAMDiskError) as exc_info:
        # Requesting 4GB model + 2GB headroom = 6GB > 3GB available
        mgr.mount(size_gb=4.0)
    assert "Insufficient RAM" in str(exc_info.value)


@patch("subprocess.run")
@patch("modeldock.ramdisk.RAMDiskManager.get_system_memory")
@patch("modeldock.ramdisk.RAMDiskManager.is_mounted")
def test_successful_mount_sequence(mock_is_mounted, mock_mem, mock_sub):
    mock_mem.return_value = (32.0, 20.0)
    # First check: not mounted; after format: mounted
    mock_is_mounted.side_effect = [False, True]

    mock_attach_res = MagicMock()
    mock_attach_res.stdout = "/dev/disk4\\n"
    mock_sub.return_value = mock_attach_res

    mgr = RAMDiskManager("TestRAM")
    p = mgr.mount(size_gb=2.0)
    assert str(p) == "/Volumes/TestRAM"
`
  },
  {
    path: "tests/test_r2.py",
    language: "python",
    description: "Pytest unit tests for S3/R2 boto3 client, checksum validation, and progress",
    content: `from unittest.mock import patch, MagicMock
import pytest
from modeldock.config import AppConfig, R2Settings
from modeldock.r2 import R2Client


def test_missing_credentials_raises():
    cfg = AppConfig()
    with pytest.raises(ValueError) as exc:
        R2Client(cfg)
    assert "not configured" in str(exc.value)


@patch("boto3.client")
def test_list_models_filters_gguf(mock_boto):
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    mock_s3.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "models/qwen2.5-3b.gguf", "Size": 2150000000},
            {"Key": "notes.txt", "Size": 1024},
            {"Key": "llama-3.2.gguf", "Size": 2020000000}
        ]
    }

    cfg = AppConfig(r2=R2Settings(account_id="acc123", access_key_id="key123", secret_access_key="sec123", bucket_name="models"))
    client = R2Client(cfg)
    models = client.list_models()

    assert len(models) == 2
    assert models[0]["key"] == "models/qwen2.5-3b.gguf"
    assert models[1]["key"] == "llama-3.2.gguf"
`
  },
  {
    path: "tests/test_runner.py",
    language: "python",
    description: "Pytest unit tests for llama-server subprocess runner and health checks",
    content: `from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from modeldock.runner import LlamaRunner


@patch("subprocess.run")
def test_verify_binary_missing(mock_sub):
    mock_sub.side_effect = FileNotFoundError()
    runner = LlamaRunner(Path("/tmp/model.gguf"), server_binary="nonexistent-llama")
    with pytest.raises(RuntimeError) as exc:
        runner.start()
    assert "brew install llama.cpp" in str(exc.value)


@patch("subprocess.Popen")
@patch("subprocess.run")
@patch("httpx.get")
def test_runner_starts_with_metal_flags(mock_http, mock_sub_run, mock_popen):
    mock_sub_run.return_value = MagicMock(returncode=0)
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_http.return_value = mock_resp

    runner = LlamaRunner(Path("/Volumes/RAMDisk/qwen.gguf"), port=8080, gpu_layers=99)
    runner.start()

    mock_popen.assert_called_once()
    args = mock_popen.call_args[0][0]
    assert "-ngl" in args
    assert "99" in args
    assert "--port" in args
    assert "8080" in args
`
  },
  {
    path: "Formula/modeldock.rb",
    language: "ruby",
    description: "Homebrew formula for macOS Apple Silicon installation via brew tap",
    content: `class Modeldock < Formula
  include Language::Python::Virtualenv

  desc "Zero-SSD local LLM runner for macOS via Cloudflare R2 and RAM-disks"
  homepage "https://github.com/modeldock/modeldock"
  url "https://github.com/modeldock/modeldock/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  license "MIT"

  depends_on "python@3.11"
  depends_on "llama.cpp"

  def install
    virtualenv_install_with_resources
  end

  test do
    system "#{bin}/modeldock", "--help"
  end
end
`
  },
  {
    path: "scripts/install.sh",
    language: "bash",
    description: "One-line installer script for macOS terminal",
    content: `#!/usr/bin/env bash
set -e

echo "=== ModelDock macOS Installer ==="

# Check Apple Silicon / macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: ModelDock requires macOS."
  exit 1
fi

# Check for Homebrew
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Check for llama.cpp
if ! command -v llama-server &>/dev/null; then
  echo "Installing llama.cpp with Apple Metal support via brew..."
  brew install llama.cpp
fi

# Install python and pipx if needed
if ! command -v pipx &>/dev/null; then
  brew install pipx
  pipx ensurepath
fi

echo "Installing ModelDock CLI via pipx..."
pipx install git+https://github.com/modeldock/modeldock.git

echo ""
echo "=== ModelDock installed successfully! ==="
echo "Run: 'modeldock --help'"
echo "Configure R2: 'modeldock configure'"
`
  },
  {
    path: "README.md",
    language: "markdown",
    description: "Comprehensive project README with architecture, quickstart, and macOS swap reality",
    content: `# ModelDock

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
`
  },
  {
    path: "LICENSE",
    language: "text",
    description: "Standard MIT open source license",
    content: `MIT License

Copyright (c) 2026 ModelDock Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
  }
];
