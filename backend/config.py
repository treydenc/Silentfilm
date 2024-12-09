# python_server/config.py
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Get configuration from environment variables
class Config:
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
    
    @staticmethod
    def validate():
        if not Config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY must be set in .env file")