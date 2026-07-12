import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from backend.services.geocoding import geocode_address
from backend.db_services import find_eligible_donors

async def main():
    # 1. Geocode "Chennai"
    coords1 = await geocode_address("Chennai")
    print(f"Chennai coords: {coords1}")
    
    # 2. Geocode "12 Anna Salai, Chennai, Tamil Nadu, India"
    coords2 = await geocode_address("12 Anna Salai, Chennai, Tamil Nadu, India")
    print(f"Anna Salai coords: {coords2}")
    
    if coords1 and coords2:
        try:
            from geopy.distance import geodesic
            dist = geodesic(coords1, coords2).km
            print(f"Distance: {dist} km")
        except ImportError:
            print("geopy not installed")
        
    if coords1:
        lat, lng = coords1
        donors = await find_eligible_donors("O-", lat, lng, radius_km=10.0)
        print(f"Found donors for 'Chennai' (radius=10km): {donors}")
        
    if coords2:
        lat, lng = coords2
        donors = await find_eligible_donors("O-", lat, lng, radius_km=10.0)
        print(f"Found donors for 'Anna Salai' (radius=10km): {donors}")

if __name__ == "__main__":
    asyncio.run(main())
