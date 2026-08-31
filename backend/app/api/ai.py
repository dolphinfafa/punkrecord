import json
import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from app.core.config import settings
from app.core.auth import get_current_user
from app.models.iam import User
from app.core.response import success_response
from app.core.exceptions import AtlasException

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    parts: List[str]


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model_name: Optional[str] = None
    system_instruction: Optional[str] = """You are a helpful software product manager assistant. Help the user break down their requests into a structured, clear feature list (功能清单).

    You MUST output ONLY a valid JSON array of feature objects matching the following exact keys for the table mapping.
    Return an array `[]` of these objects:
    {
        "index": "1",
        "product": "产品端名称 (例如: 前端Web页面, 后端管理平台, iOS App, 微信小程序 等)",
        "module": "模块名称",
        "l1_feature": "一级功能",
        "l2_feature": "二级功能",
        "description": "详细的功能说明",
        "dev_backend": "后端开发用时估算(纯数字,例如: 1, 0.5)",
        "dev_frontend": "前端开发用时估算(纯数字)",
        "dev_ui": "UI设计用时估算(纯数字)",
        "dev_product": "产品规划用时估算(纯数字)"
    }
    """


def _build_openai_messages(request: ChatRequest) -> list:
    """Convert Gemini-style messages to OpenAI format."""
    messages = []
    if request.system_instruction:
        messages.append({"role": "system", "content": request.system_instruction})
    for msg in request.messages:
        role = "assistant" if msg.role == "model" else "user"
        messages.append({"role": role, "content": "\n".join(msg.parts)})
    return messages


def _normalize_model_name(model: str) -> str:
    """Keep direct OpenAI-compatible model names intact; prefix legacy Gemini names for LiteLLM."""
    if "/" in model:
        return model
    if model.startswith("gemini-"):
        return f"gemini/{model}"
    return model


@router.post("/chat", response_model=dict)
async def ai_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat with AI to generate feature lists in JSON format via LiteLLM."""
    try:
        model = _normalize_model_name(request.model_name or settings.LITELLM_MODEL)

        url = f"{settings.LITELLM_BASE_URL}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
        }
        payload = {
            "model": model,
            "messages": _build_openai_messages(request),
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            ai_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            return success_response({"text": ai_text})

    except httpx.HTTPError as he:
        raise AtlasException(f"AI Network Error: {str(he)}", code=502)
    except Exception as e:
        raise AtlasException(f"AI Service Error: {str(e)}", code=500)


@router.post("/chat-stream")
async def ai_chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat with AI using SSE streaming via LiteLLM."""

    async def generate_chunks():
        try:
            model = _normalize_model_name(request.model_name or settings.LITELLM_MODEL)

            url = f"{settings.LITELLM_BASE_URL}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
            }
            payload = {
                "model": model,
                "messages": _build_openai_messages(request),
                "stream": True,
            }

            async with httpx.AsyncClient(verify=False, timeout=300.0) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield f"data: {json.dumps({'error': f'API Error {response.status_code}: {error_text.decode()}'})}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw.strip() == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(raw)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                # Forward as Gemini-compatible SSE for frontend
                                yield f"data: {json.dumps({'candidates': [{'content': {'parts': [{'text': text}]}}]})}\n\n"
                        except (json.JSONDecodeError, IndexError, KeyError):
                            continue

        except Exception as e:
            yield f"data: {json.dumps({'error': f'Stream failed: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate_chunks(),
        media_type="text/event-stream"
    )
