import json
import logging

from app.core.config import settings


def format_log_json(value: object) -> str:
    """把对象格式化为适合日志展示的 JSON。"""

    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def configure_logging() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
