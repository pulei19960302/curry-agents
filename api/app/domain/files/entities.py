from datetime import datetime
from dataclasses import dataclass
from uuid import UUID

# 这里不是数据库模型
@dataclass(slots=True)
class FileObject:
    # id
    id: UUID

    # 原始名字
    original_name: str

    # 后端真正保存到磁盘的文件名。用uuid生成，避免重复
    stored_name: str

    # 类型
    content_type: str

    # 大小
    size: int

    # 存储位置
    storage_path: str

    # 创建时间
    created_at: datetime