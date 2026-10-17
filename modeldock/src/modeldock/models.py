from typing import Dict, Any, Optional
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
