-- RailNova PostgreSQL Schema
-- Segment-Based Railway Reservation Engine

-- Enable Range Types and (optional) GiST extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PASSENGER', 'ORGANISER')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trains table (Organiser owned)
CREATE TABLE IF NOT EXISTS trains (
  id TEXT PRIMARY KEY,
  organiser_id TEXT NOT NULL REFERENCES users(id),
  train_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source_station_code TEXT NOT NULL,
  dest_station_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  train_id TEXT NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Route Stops
CREATE TABLE IF NOT EXISTS route_stops (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL REFERENCES stations(id),
  stop_sequence INTEGER NOT NULL,
  distance_km NUMERIC NOT NULL,
  default_dwell_minutes INTEGER NOT NULL DEFAULT 5,
  is_change_permitted BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (route_id, stop_sequence)
);

-- Train Runs (Specific dated instances of a train service)
CREATE TABLE IF NOT EXISTS train_runs (
  id TEXT PRIMARY KEY,
  train_id TEXT NOT NULL REFERENCES trains(id),
  route_id TEXT NOT NULL REFERENCES routes(id),
  run_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED')) DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (train_id, run_date)
);

-- Run Stops (Ordered stops with absolute arrival/departure times)
CREATE TABLE IF NOT EXISTS run_stops (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL REFERENCES stations(id),
  stop_sequence INTEGER NOT NULL,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  platform TEXT DEFAULT '1',
  is_change_permitted BOOLEAN NOT NULL DEFAULT TRUE,
  distance_from_origin_km NUMERIC DEFAULT 0,
  UNIQUE (run_id, stop_sequence)
);

-- Run Seats (Physical berths for this specific train run)
CREATE TABLE IF NOT EXISTS run_seats (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
  coach_code TEXT NOT NULL,
  coach_type TEXT NOT NULL CHECK (coach_type IN ('SL', '3A', '2A', '1A')),
  seat_number INTEGER NOT NULL,
  berth_type TEXT NOT NULL CHECK (berth_type IN ('LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'CABIN')),
  base_fare INTEGER NOT NULL, -- minor currency units (paise / cents)
  UNIQUE (run_id, coach_code, seat_number)
);

-- Bookings (Parent Itinerary)
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL, -- PNR Code e.g. RN-104928
  user_id TEXT NOT NULL REFERENCES users(id),
  journey_type TEXT NOT NULL CHECK (journey_type IN ('DIRECT', 'SAME_TRAIN_CHANGE', 'TWO_TRAIN_CONNECTION')),
  status TEXT NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'PAYMENT_FAILED', 'CANCELLED')),
  disruption_status TEXT NOT NULL CHECK (disruption_status IN ('NONE', 'DISRUPTED', 'REVIEW_REQUIRED')) DEFAULT 'NONE',
  total_amount INTEGER NOT NULL, -- minor currency units
  hold_expires_at TIMESTAMPTZ,
  change_acknowledged BOOLEAN DEFAULT FALSE,
  quote_snapshot TEXT, -- JSON snapshot of calculation rules
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Booking Legs
CREATE TABLE IF NOT EXISTS booking_legs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,
  run_id TEXT NOT NULL REFERENCES train_runs(id),
  from_station_code TEXT NOT NULL,
  to_station_code TEXT NOT NULL,
  from_stop_seq INTEGER NOT NULL,
  to_stop_seq INTEGER NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  leg_fare INTEGER NOT NULL,
  coach_code TEXT,
  requires_transfer BOOLEAN DEFAULT FALSE,
  requires_seat_change BOOLEAN DEFAULT FALSE,
  UNIQUE (booking_id, leg_order)
);

-- Passengers
CREATE TABLE IF NOT EXISTS passengers (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  berth_preference TEXT
);

-- Seat Allocations (Segment-based interval reservation)
CREATE TABLE IF NOT EXISTS seat_allocations (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  leg_id TEXT NOT NULL REFERENCES booking_legs(id) ON DELETE CASCADE,
  passenger_id TEXT NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  run_seat_id TEXT NOT NULL REFERENCES run_seats(id),
  from_stop_seq INTEGER NOT NULL,
  to_stop_seq INTEGER NOT NULL,
  journey_interval INT4RANGE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'RELEASED')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payment Attempts
CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  scenario TEXT NOT NULL, -- 'SUCCESS', 'FAILURE', 'TIMEOUT', 'DELAYED_SUCCESS'
  gateway_ref TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (booking_id, idempotency_key)
);

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_attempt_id TEXT REFERENCES payment_attempts(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED_RETRYABLE')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Fare Rules
CREATE TABLE IF NOT EXISTS fare_rules (
  id TEXT PRIMARY KEY,
  class_code TEXT UNIQUE NOT NULL,
  base_rate_per_km NUMERIC NOT NULL,
  min_fare INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

-- Idempotency Records
CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  operation_type TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_seat_alloc_run_seat ON seat_allocations(run_seat_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_alloc_active ON seat_allocations(run_seat_id, from_stop_seq, to_stop_seq) WHERE status IN ('HELD', 'CONFIRMED');
CREATE INDEX IF NOT EXISTS idx_run_stops_run ON run_stops(run_id, stop_sequence);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_train_runs_date ON train_runs(run_date, status);
