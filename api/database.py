import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in .env")

client = MongoClient(MONGO_URI)

db = client["supportnova"]

complaints_collection = db["complaints"]
analyses_collection = db["analyses"]
users_collection = db["users"]
audit_logs_collection = db["audit_logs"]
knowledge_documents_collection = db["knowledge_documents"]