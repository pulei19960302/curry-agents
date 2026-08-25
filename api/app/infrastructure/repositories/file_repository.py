from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.files.entities import FileObject
from app.infrastructure.database.models import FileObjectModel


class SqlAlchemyFileRepository:

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session


    async def add(
        self,
        original_name: str,
        stored_name: str,
        content_type: str,
        size: int,
        storage_path: str
    ) -> FileObject:
        model = FileObjectModel(
            original_name=original_name,
            stored_name=stored_name,
            content_type=content_type,
            size=size,
            storage_path=storage_path,
        )
        self.db_session.add(model)
        await self.db_session.flush()
        await self.db_session.refresh(model)
        return model.to_entity()


    async def get(self, file_id: UUID) -> FileObject | None:
        stmt: Select[tuple[FileObjectModel]] = select(FileObjectModel).where(
            FileObjectModel.id == file_id
        )

        result = await self.db_session.execute(stmt)
        model = result.scalar_one_or_none()
        return model.to_entity() if model else None
