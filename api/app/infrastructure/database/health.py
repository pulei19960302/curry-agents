from sqlalchemy import text

from sqlalchemy.ext.asyncio import AsyncSession


# 数据库连接状态检测。向数据库发送一个数据，看看能不能收到回复
async def check_database(db_session: AsyncSession) -> bool:
    result = await db_session.execute(text("select 1"))
    return result.scalar_one() == 1
