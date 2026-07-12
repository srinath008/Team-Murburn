import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import sys

# Load env variables from root .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def update_donor():
    from backend.db_services import register_donor, close, _get_driver

    old_phone = "+91902534022"
    new_phone = "+919092534022"
    lat, lng = 12.9716, 77.5946
    try:
        # First remove the old one just to keep things clean
        driver = _get_driver()
        async with driver.session() as session:
            await session.run("MATCH (d:Donor {phone: $old}) DETACH DELETE d", old=old_phone)
            
        # Register the new one
        donor = await register_donor(
            name="Test User",
            phone=new_phone,
            blood_group="O+",
            language="english",
            lat=lat,
            lng=lng
        )
        print(f"Success! Corrected donor registered with phone {new_phone}")
    except Exception as e:
        print(f"Failed: {e}")
    finally:
        await close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(update_donor())
