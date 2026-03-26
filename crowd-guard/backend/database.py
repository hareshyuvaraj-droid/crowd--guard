from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import os

from models import User, Zone, Alert

client: AsyncIOMotorClient = None

async def connect_db():
    global client
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.getenv("DB_NAME", "crowdguard")]
    await init_beanie(database=db, document_models=[User, Zone, Alert])
    print("✅ MongoDB connected")

async def disconnect_db():
    if client:
        client.close()
        print("MongoDB disconnected")
