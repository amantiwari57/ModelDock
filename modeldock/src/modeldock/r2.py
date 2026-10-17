import hashlib
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
