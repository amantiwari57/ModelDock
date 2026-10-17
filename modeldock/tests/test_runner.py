from pathlib import Path
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
