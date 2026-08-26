api/app/domain/files/entities.py | +-- 文件领域数据结构

api/app/domain/files/repositories.py | +-- 文件元数据仓库协议

api/app/domain/files/storage.py | +-- 文件内容存储协议

api/app/infrastructure/repositories/file_repository.py | +-- PostgreSQL 元数据实现

api/app/infrastructure/storage/local.py | +-- 本地磁盘内容存储实现

api/app/infrastructure/storage/factory.py | +-- 根据配置创建存储实现

api/app/application/file_service.py | +-- 编排上传、下载、预览、会话文件业务流程