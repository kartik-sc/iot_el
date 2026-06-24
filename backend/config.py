from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://kartik:157846@localhost/iot_el"
    firebase_service_account_path: str = "./firebase-service-account.json"
    firebase_service_account_json: str = ""
    clerk_secret_key: str = ""
    allowed_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
