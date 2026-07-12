// =============================================================================
// NEO4J SCHEMA SETUP — AI Blood Dispatch Network
// Run this once against a fresh AuraDB instance (Neo4j Browser or `cypher-shell`)
// before running ingest_csv.py or any backend queries.
// =============================================================================

// --- Constraints ---------------------------------------------------------
// Every donor must have a unique id (prevents duplicate inserts on re-ingest)
CREATE CONSTRAINT donor_id_unique IF NOT EXISTS
FOR (d:Donor) REQUIRE d.id IS UNIQUE;

// Every hospital must have a unique id
CREATE CONSTRAINT hospital_id_unique IF NOT EXISTS
FOR (h:Hospital) REQUIRE h.id IS UNIQUE;

// Every dispatch must have a unique id
CREATE CONSTRAINT dispatch_id_unique IF NOT EXISTS
FOR (d:Dispatch) REQUIRE d.id IS UNIQUE;

// Every call session must have a unique sid
CREATE CONSTRAINT call_sid_unique IF NOT EXISTS
FOR (c:CallSession) REQUIRE c.sid IS UNIQUE;

// --- Indexes ---------------------------------------------------------------
// Point index powers the spatial radius queries (point.distance)
CREATE POINT INDEX donor_location_index IF NOT EXISTS
FOR (d:Donor) ON (d.location);

// Speeds up blood_group + last_donated_date filtering (used on every dispatch)
CREATE INDEX donor_blood_group_index IF NOT EXISTS
FOR (d:Donor) ON (d.blood_group);

CREATE INDEX donor_last_donated_index IF NOT EXISTS
FOR (d:Donor) ON (d.last_donated_date);

// Fast lookups for calls by dispatch_id
CREATE INDEX call_dispatch_index IF NOT EXISTS
FOR (c:CallSession) ON (c.dispatch_id);

// =============================================================================
// Node shape reference (matches system_architecture_manifest.md data contract)
// =============================================================================
// (:Donor {
//   id: "UUID string",
//   name: "string",
//   phone: "string",
//   blood_group: "string e.g. 'O-'",
//   language: "string 'tamil' | 'hindi' | 'english'",
//   location: point({latitude: float, longitude: float}),
//   has_app: boolean,
//   last_donated_date: datetime | null,
//   push_token: string | null   -- Expo push token, set once the mobile
//                                   app requests one and registers it.
//                                   NULL until the frontend implements
//                                   getExpoPushTokenAsync() at registration.
// })
//
// (:Hospital {
//   id: "UUID string",
//   name: "string",
//   location: point({latitude: float, longitude: float})
// })
