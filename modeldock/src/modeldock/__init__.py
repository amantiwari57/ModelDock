"""
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
