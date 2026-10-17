from unittest.mock import patch, MagicMock
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
