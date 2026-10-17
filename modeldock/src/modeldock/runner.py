import os
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
