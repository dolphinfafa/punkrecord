import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
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
    model_name: Optional[str] = "gemini-3.1-pro-preview"
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

@router.post("/chat", response_model=dict)
async def ai_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat with Gemini AI to generate feature lists in JSON format using httpx for robust proxy support"""
    try:
        api_key = settings.GEMINI_API_KEY if hasattr(settings, 'GEMINI_API_KEY') else os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise AtlasException("Gemini API key is not configured in environment variables.", code=500)

        # Use dynamically passed model_name or fallback to default
        model = request.model_name or "gemini-3.1-pro-preview"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        # Build contents array
        gemini_contents = []
        for msg in request.messages:
            gemini_contents.append({
                "role": msg.role, 
                "parts": [{"text": part} for part in msg.parts]
            })

        payload = {
            "contents": gemini_contents,
            "systemInstruction": {
                "role": "user",
                "parts": [{"text": request.system_instruction}]
            },
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }

        # Setup httpx client (disabling SSL verification to avoid common local proxy cert issues)
        async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract text
            candidates = data.get("candidates", [])
            if not candidates:
                raise Exception("No response candidates returned from Gemini.")
                
            ai_text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
            
            return success_response({
                "text": ai_text
            })
            
    except httpx.HTTPError as he:
        import traceback
        traceback.print_exc()
        raise AtlasException(f"AI Network Error: Failed to reach Gemini API. Please check your proxy settings. Details: {str(he)}", code=502)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise AtlasException(f"AI Service Error: {str(e)}", code=500)
