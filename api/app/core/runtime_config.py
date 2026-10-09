from pathlib import Path
from shutil import copyfile


def ensure_runtime_config(config_path: str, default_filename: str) -> Path:
    """首次读取时用镜像内的默认配置初始化运行时配置。"""

    target = Path(config_path)
    if target.is_file():
        return target

    if target.exists():
        raise IsADirectoryError(f"Runtime config path is not a file: {target}")

    # runtime_config.py 位于 api/app/core，parents[2] 对应 api 根目录。
    api_root = Path(__file__).resolve().parents[2]
    source = api_root / "config" / default_filename
    if not source.is_file():
        raise FileNotFoundError(f"Default config file not found: {source}")

    target.parent.mkdir(parents=True, exist_ok=True)
    copyfile(source, target)
    return target
