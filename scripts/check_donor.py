import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from root .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def check_donor():
    from backend.db_services import _get_driver, close
    driver = _get_driver()
    phone = "+91902534022"
    
    query = "MATCH (d:Donor {phone: $phone}) RETURN d"
    async with driver.session() as session:
        result = await session.run(query, phone=phone)
        record = await result.single()
        
        if record:
            d = record["d"]
            print(f"✅ Found donor in DB:")
            print(f"ID: {d.get('id')}")
            print(f"Name: {d.get('name')}")
            print(f"Phone: {d.get('phone')}")
            print(f"Blood Group: {d.get('blood_group')}")
            print(f"Location: {d.get('location')}")
        else:
            print(f"❌ Donor with phone {phone} NOT found in database.")
            
    await close()

if __name__ == "__main__":
    asyncio.run(check_donor())
