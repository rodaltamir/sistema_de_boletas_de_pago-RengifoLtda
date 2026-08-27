from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Integral de Planillas y Boletas de Pago Rengifo - API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_SERVER: str = "localhost" # o 'db' si corre desde docker
    POSTGRES_USER: str = "admin_rengifo"
    POSTGRES_PASSWORD: str = "rengifo_planillaspago-826"
    POSTGRES_DB: str = "db_planillas_pago_rengifo"
    POSTGRES_PORT: str = "5454"
    
    # JWT
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 días

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
