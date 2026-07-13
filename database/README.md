# Database & Infra Setup Guide

This covers everything needed to get the Neo4j + ingestion + Docker side of
the project running locally.

## 1. Create the Neo4j AuraDB Instance

1. Go to [console.neo4j.io](https://console.neo4j.io) and sign up / log in.
2. Click **New Instance** → choose the **Free** tier (plenty for a hackathon).
3. Name it (e.g. `blood-dispatch-hackathon`) and create it.
4. **Important:** AuraDB shows you the generated password *once* — copy it
   immediately. If you lose it, you'll need to reset it.
5. Copy the **Connection URI** (starts with `neo4j+s://...`).

## 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Fill in `.env` with:
- `NEO4J_URI` — from step 1
- `NEO4J_USERNAME` — usually `neo4j`
- `NEO4J_PASSWORD` — from step 1

Geocoding uses OpenStreetMap Nominatim (free, no API key required) — see
`database/ingest_csv.py`. No geocoding setup needed.

## 3. Install Dependencies

```bash
pip install -r database/requirements.txt
```

## 4. Initialize the Schema

Open your AuraDB instance's **Neo4j Browser** (link in the Aura console) and
paste in the contents of `database/schema.cypher`, or run it via
`cypher-shell`:

```bash
cypher-shell -a $NEO4J_URI -u $NEO4J_USERNAME -p $NEO4J_PASSWORD -f database/schema.cypher
```

## 5. Test the Ingestion Script

```bash
python database/ingest_csv.py --file database/sample_donors.csv
```

This should geocode the 3 sample rows and insert them as `:Donor` nodes.
Verify in Neo4j Browser with:

```cypher
MATCH (d:Donor) RETURN d LIMIT 10;
```

## 6. Build the Docker Image (once backend has a `main.py`)

```bash
docker build -t blood-dispatch-backend .
docker compose up
```

## Handoff to Backend Team

The query functions backend needs are already written and documented in
`backend/db_services/queries.py`:
- `find_eligible_donors(...)` — spatial + cooldown match
- `log_donation(...)` — starts the 56-day cooldown
- `get_donor(...)` — single donor lookup for routing

They just need to create a `neo4j.Driver` instance and pass it in — no
Cypher knowledge required on their end.
