
from collections.abc import AsyncIterator
from json import dumps



# 输入： encode_sse("message_created", {"type": "message_created"})

# 输出：
    # event: message_created
    # data: {"type":"message_created"}

def encode_sse(event: str, data: dict) -> str:
    payload = dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


async def iter_sse(events: list[tuple[str, dict]]) -> AsyncIterator[str]:
    for event, data in events:
        yield encode_sse(event, data)