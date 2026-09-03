"""CrisisConnect Backend Entrypoint.

Allows running directly via:
    uvicorn main:app --host 0.0.0.0 --port $PORT
or
    python main.py
"""
import sys
import os

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

if __name__ == "__main__":
    import uvicorn
    from app.config import PORT, HOST
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
