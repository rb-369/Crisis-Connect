import pytest
import pytest_asyncio
from app import db, expiry

@pytest_asyncio.fixture(autouse=True)
async def lifespan_fixture():
    await db.connect()
    expiry.start()
    yield
    await expiry.stop()
    await db.disconnect()
