"""
database/ingest_csv.py
========================
Bulk-uploads a hospital's legacy donor spreadsheet (CSV) into Neo4j.

WHAT IT DOES:
    1. Reads a CSV of donors (name, phone, blood_group, language, address).
    2. Geocodes each address into (lat, lng) using OpenStreetMap Nominatim
       (free, no API key required).
    3. Inserts each donor as a (:Donor) node in Neo4j with has_app = false
       (legacy donors don't have the app until they register themselves).

EXPECTED CSV COLUMNS:
    name, phone, blood_group, language, address
    (see database/sample_donors.csv for an example)

USAGE:
    python database/ingest_csv.py --file path/to/donors.csv

ENV VARS REQUIRED (see .env.example):
    NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
"""

import argparse
import csv
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

GEOCODE_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "BloodDispatchNetwork-Hackathon/1.0"

# Nominatim usage policy: max 1 request per second.
SECONDS_BETWEEN_GEOCODE_CALLS = 1.1


def geocode_address(address: str) -> Optional[dict]:
    """
    Convert a street address into {"lat": float, "lng": float} using
    OpenStreetMap Nominatim (free, no API key required).
    Returns None if the address couldn't be geocoded (logged, not fatal —
    we skip that row rather than crash the whole ingest).
    """
    response = requests.get(
        GEOCODE_URL,
        params={"q": address, "format": "json", "limit": 1},
        headers={"User-Agent": NOMINATIM_USER_AGENT},
        timeout=10,
    )
    response.raise_for_status()
    results = response.json()

    if not results:
        print(f"  [WARN] Could not geocode: '{address}' (no results)")
        return None

    return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}


_INSERT_DONOR_QUERY = """
MERGE (d:Donor {id: $id})
SET d.name = $name,
    d.phone = $phone,
    d.blood_group = $blood_group,
    d.language = $language,
    d.location = point({latitude: $lat, longitude: $lng}),
    d.has_app = false,
    d.last_donated_date = null
RETURN d.id AS id
"""


def insert_donor(driver, donor: dict) -> None:
    with driver.session() as session:
        session.run(
            _INSERT_DONOR_QUERY,
            id=donor["id"],
            name=donor["name"],
            phone=donor["phone"],
            blood_group=donor["blood_group"],
            language=donor["language"],
            lat=donor["lat"],
            lng=donor["lng"],
        )


def run_ingest(csv_path: Path) -> None:
    neo4j_uri = os.environ["NEO4J_URI"]
    neo4j_user = os.environ["NEO4J_USERNAME"]
    neo4j_password = os.environ["NEO4J_PASSWORD"]

    driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))

    inserted, skipped = 0, 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required_cols = {"name", "phone", "blood_group", "language", "address"}
        missing = required_cols - set(reader.fieldnames or [])
        if missing:
            sys.exit(f"CSV is missing required columns: {missing}")

        for row_num, row in enumerate(reader, start=2):  # row 1 = header
            address = row["address"].strip()
            print(f"Row {row_num}: geocoding '{address}'...")

            coords = geocode_address(address)
            time.sleep(SECONDS_BETWEEN_GEOCODE_CALLS)

            if coords is None:
                skipped += 1
                continue

            donor = {
                "id": str(uuid.uuid4()),
                "name": row["name"].strip(),
                "phone": row["phone"].strip(),
                "blood_group": row["blood_group"].strip(),
                "language": row["language"].strip().lower(),
                "lat": coords["lat"],
                "lng": coords["lng"],
            }
            insert_donor(driver, donor)
            inserted += 1

    driver.close()
    print(f"\nDone. Inserted: {inserted}, Skipped (bad address): {skipped}")


def main():
    parser = argparse.ArgumentParser(description="Bulk-ingest donor CSV into Neo4j.")
    parser.add_argument("--file", required=True, help="Path to donor CSV file")
    args = parser.parse_args()

    csv_path = Path(args.file)
    if not csv_path.exists():
        sys.exit(f"File not found: {csv_path}")

    run_ingest(csv_path)


if __name__ == "__main__":
    main()
