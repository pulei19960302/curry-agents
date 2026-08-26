from fastapi import APIRouter, Depends

from app.application.llm_service import LLMService
from app.domain.llm.entities import LLMMessage
from app.schemas.common import ApiResponse
from app.schemas.llm import LLMChatResponse, LLMChatRequest

router = APIRouter(
    prefix="/llm",
    tags=["llm"],
)


def build_llm_service() -> LLMService:
    return LLMService()


@router.post("/chat", response_model=ApiResponse[LLMChatResponse])
async def chat(
        payload: LLMChatRequest,
        service: LLMService = Depends(build_llm_service),
) -> ApiResponse[LLMChatResponse]:
    result = await service.chat(
        messages=[
            LLMMessage(role=message.role, content=message.content)
            for message in payload.messages
        ],
        provider=payload.provider,
        model=payload.model,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
    )

    return ApiResponse(
        data=LLMChatResponse(
            content=result.content,
            model=result.model,
            provider=result.provider,
            usage=result.usage,
        )
    )
