from unittest.mock import patch, MagicMock
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
