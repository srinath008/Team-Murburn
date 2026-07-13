# HaemNet Database (Neo4j)

HaemNet utilizes **Neo4j AuraDB**, a powerful cloud-native Graph Database, to model and traverse the complex relationships between donors, hospitals, and their geospatial locations.

## Why a Graph Database?
Emergency blood dispatch is fundamentally a problem of relationships and geography. Traditional relational databases (SQL) struggle with highly connected data and complex spatial queries. Neo4j allows us to perform sub-millisecond traversals to find exact matches.

### Core Query Requirements
To find an eligible donor, the database must instantly filter by three strict conditions:
1. **Blood Group Matching:** The donor must have a compatible blood type.
2. **Spatial Radius:** The donor must be physically located within 10km of the requesting hospital.
3. **Temporal Cooldown:** The donor's `last_donated_date` must be `NULL` or older than 56 days.

Neo4j handles this effortlessly using Cypher queries and native spatial indexing.

## The Data Model (Nodes & Relationships)

### `Donor` Node
Represents a registered blood donor.
- `id` (UUID)
- `name` (String)
- `phone` (String)
- `blood_group` (String)
- `language` (String: e.g., 'tamil', 'hindi', 'english')
- `location` (Point: Latitude/Longitude spatial data)
- `has_app` (Boolean: Used for determining SMS vs Push Notification routing)
- `last_donated_date` (DateTime: Nullable)

### `Hospital` Node
Represents a medical facility.
- `id` (UUID)
- `name` (String)
- `location` (Point)

## Connecting to the Database

The backend connects to Neo4j using the official Python driver. Ensure your `.env` file in the backend is configured with your AuraDB credentials:

```env
NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_secure_password
```

## Setup & Seeding
If you need to seed the database with mock donors for testing, refer to the backend `db_services` directory or use the provided Python scripts in the root `scripts/` directory (if applicable) to generate spatially distributed nodes.
