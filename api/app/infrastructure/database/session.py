from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo = settings.database_echo,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


# create_async_engine() 创建异步数据库引擎。

# async_sessionmaker() 创建数据库会话工厂。

# get_db_session() 是 FastAPI 依赖函数，后续接口可以通过 Depends(get_db_session) 获取数据库会话。

# pool_pre_ping=True 会在连接被使用前检查连接是否可用，可以减少数据库连接断开导致的偶发错误。