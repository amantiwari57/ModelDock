from pathlib import Path
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
