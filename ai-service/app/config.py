import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Search and load .env files relative to this file's location
_current_dir = Path(__file__).resolve().parent # app
_ai_dir = _current_dir.parent                 # ai-service
_root_dir = _ai_dir.parent                    # lendguard-ai

# Try loading from ai-service/.env, then from root .env.staging
if (_ai_dir / ".env").exists():
    load_dotenv(_ai_dir / ".env")
if (_root_dir / ".env.staging").exists():
    load_dotenv(_root_dir / ".env.staging")

class Settings(BaseModel):
    service_name: str = "lendguard-ai-service"
    service_version: str = "1.0.0"
    ai_service_key: str = os.getenv("AI_SERVICE_KEY", "lendguard_internal_ai_secret_key_2026")
    ai_provider: str = os.getenv("AI_PROVIDER", "nvidia")
    ai_api_key: str = os.getenv("AI_API_KEY", "")
    ai_model: str = os.getenv("AI_MODEL", "minimaxai/minimax-m3.1-flash")
    ai_base_url: str = os.getenv("AI_BASE_URL", "https://integrate.api.nvidia.com/v1")
    ai_timeout_seconds: float = float(os.getenv("AI_TIMEOUT_SECONDS", "10.0"))

settings = Settings()
