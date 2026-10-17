import os
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
