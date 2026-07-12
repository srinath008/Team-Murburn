import os
from pathlib import Path
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

def setup():
    uri = os.environ.get("NEO4J_URI")
    user = os.environ.get("NEO4J_USER")
    password = os.environ.get("NEO4J_PASSWORD")
    
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    queries = [
        "CREATE CONSTRAINT donor_id_unique IF NOT EXISTS FOR (d:Donor) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT hospital_id_unique IF NOT EXISTS FOR (h:Hospital) REQUIRE h.id IS UNIQUE",
        "CREATE CONSTRAINT dispatch_id_unique IF NOT EXISTS FOR (d:Dispatch) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT call_sid_unique IF NOT EXISTS FOR (c:CallSession) REQUIRE c.sid IS UNIQUE",
        "CREATE POINT INDEX donor_location_index IF NOT EXISTS FOR (d:Donor) ON (d.location)",
        "CREATE INDEX donor_blood_group_index IF NOT EXISTS FOR (d:Donor) ON (d.blood_group)",
        "CREATE INDEX donor_last_donated_index IF NOT EXISTS FOR (d:Donor) ON (d.last_donated_date)",
        "CREATE INDEX call_dispatch_index IF NOT EXISTS FOR (c:CallSession) ON (c.dispatch_id)"
    ]
        
    with driver.session() as session:
        for q in queries:
            print(f"Running: {q}")
            session.run(q)
            
    print("Schema applied successfully.")

if __name__ == "__main__":
    setup()
