import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from root .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def seed_test_donor():
    from backend.db_services import register_donor, close
    import sys

    phone = input("\nEnter your phone number (e.g., +919876543210): ").strip()
    if not phone:
        print("Phone number is required.")
        return

    print("\nRegistering your phone number as a mock donor at 'MG Road, Bangalore'...")
    try:
        # Bangalore coordinates
        lat, lng = 12.9716, 77.5946
        donor = await register_donor(
            name="Test User",
            phone=phone,
            blood_group="O+",
            language="english",
            lat=lat,
            lng=lng
        )
        print(f"\n✅ Success! Donor registered with ID: {donor.id}")
        print("Make sure you trigger an emergency near Bangalore (or type 'MG Road, Bangalore' as the address) to get matched.")
    except Exception as e:
        print(f"\n❌ Failed: {e}")
    finally:
        await close()

if __name__ == "__main__":
    asyncio.run(seed_test_donor())
