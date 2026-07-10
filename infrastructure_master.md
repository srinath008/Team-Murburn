# MASTER SYSTEM INSTRUCTIONS: AI BLOOD NETWORK DATA & INFRA

## 1. Project Context
We are building an AI-powered emergency blood dispatch network. The system requires a highly optimized graph database (Neo4j AuraDB) to handle real-time geographic distance calculations and 56-day medical cooldown filtering before passing data to an AI voice dispatch backend. The entire system must be containerized for scalable deployment.

## 2. Your Domain: Data & DevOps
**Directory Restriction:** `database/` and root `Dockerfile`
**AI DIRECTIVE:** You are assisting the Data & DevOps Engineer. You are strictly forbidden from writing frontend React code or the core AI LangGraph logic. Your focus is strictly on Neo4j schema creation, Cypher query optimization, data ingestion scripts, and Docker containerization.

## 3. Technical Specifications & Tasks
* **Database:** Neo4j AuraDB. 
* **Query Engineering:** Write complex Cypher queries that:
    1. Perform spatial matching (finding donor nodes within a 10km radius of the hospital node).
    2. Enforce the 56-day cooldown (filter out nodes where `last_donated_date` is < 56 days ago).
* **Data Ingestion:** Write a standalone Python script in `database/ingest_csv.py` that allows hospitals to bulk-upload legacy donor spreadsheets, geocode their addresses, and insert them into Neo4j with a `has_app = false` flag.
* **DevOps:** Create a multi-stage `Dockerfile` and a `docker-compose.yml` file to run the FastAPI backend locally and package it for Google Cloud Run / Render deployment.

## 4. Git & Collaboration Workflow
* **Branching:** All infrastructure work must happen on branches prefixed with `infra/` (e.g., `git checkout -b infra/neo4j-queries`).
* **Handoff:** Export your Cypher queries as cleanly documented Python functions inside `backend/db_services/queries.py` so the Backend Lead can import them without having to write database logic.
* **Merge Rules:** Never push directly to `main`. Test the Docker build locally before issuing a Pull Request.