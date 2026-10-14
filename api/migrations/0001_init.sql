-- Migration number: 0001 	 2026-10-14T17:47:21.277Z
CREATE TABLE names (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  first_city INTEGER NOT NULL,
  city_count INTEGER NOT NULL
);

CREATE TABLE cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  country TEXT NOT NULL,
  population INTEGER NOT NULL
);