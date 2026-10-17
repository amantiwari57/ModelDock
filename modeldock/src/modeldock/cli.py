from pathlib import Path
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
