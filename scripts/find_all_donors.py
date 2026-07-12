import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def check_donors():
    from backend.db_services import _get_driver, close
    driver = _get_driver()
    
    query = "MATCH (d:Donor) RETURN d"
    async with driver.session() as session:
        result = await session.run(query)
        records = await result.data()
        
        print(f"Total donors: {len(records)}")
        for i, rec in enumerate(records):
            d = rec["d"]
            print(f"[{i}] Name: {d.get('name')}, Blood: {d.get('blood_group')}, Loc: {d.get('location')}, Phone: {d.get('phone')}")
            
    await close()

if __name__ == "__main__":
    asyncio.run(check_donors())
