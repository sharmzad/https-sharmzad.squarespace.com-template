-- Create Expert Trips tables

-- Expert Trips - Main table for expert-created trips
CREATE TABLE IF NOT EXISTS expert_trips (
  id SERIAL PRIMARY KEY,
  expert_id INTEGER NOT NULL REFERENCES expert_profiles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  expert_type VARCHAR(50) NOT NULL,
  trip_type VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  location VARCHAR(255) NOT NULL,
  duration VARCHAR(100),
  max_group_size INTEGER,
  start_date DATE,
  end_date DATE,
  image VARCHAR(500),
  highlights TEXT,
  requirements TEXT,
  included_services TEXT,
  excluded_services TEXT,
  cancellation_policy TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  admin_notes TEXT,
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expert_trips_expert ON expert_trips(expert_id);
CREATE INDEX idx_expert_trips_status ON expert_trips(status);
CREATE INDEX idx_expert_trips_location ON expert_trips(location);
CREATE INDEX idx_expert_trips_expert_type ON expert_trips(expert_type);

-- Expert Trip Bookings - Guest checkout bookings
CREATE TABLE IF NOT EXISTS expert_trip_bookings (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES expert_trips(id),
  user_id INTEGER REFERENCES users(id),
  traveler_name VARCHAR(255) NOT NULL,
  traveler_email VARCHAR(255) NOT NULL,
  traveler_phone VARCHAR(50) NOT NULL,
  travelers INTEGER DEFAULT 1,
  special_requests TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  booking_status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_intent_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expert_trip_bookings_trip ON expert_trip_bookings(trip_id);
CREATE INDEX idx_expert_trip_bookings_email ON expert_trip_bookings(traveler_email);
CREATE INDEX idx_expert_trip_bookings_status ON expert_trip_bookings(booking_status);

-- Expert Trip Payments - Escrow payments with commission
CREATE TABLE IF NOT EXISTS expert_trip_payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES expert_trip_bookings(id),
  trip_id INTEGER NOT NULL REFERENCES expert_trips(id),
  expert_id INTEGER NOT NULL REFERENCES expert_profiles(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  platform_commission DECIMAL(10, 2) NOT NULL,
  expert_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'escrow',
  payment_method VARCHAR(50),
  stripe_payment_id VARCHAR(255),
  release_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expert_trip_payments_booking ON expert_trip_payments(booking_id);
CREATE INDEX idx_expert_trip_payments_expert ON expert_trip_payments(expert_id);
CREATE INDEX idx_expert_trip_payments_status ON expert_trip_payments(status);

-- Expert Trip Disputes - Handle cancellations and complaints
CREATE TABLE IF NOT EXISTS expert_trip_disputes (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES expert_trip_bookings(id),
  trip_id INTEGER NOT NULL REFERENCES expert_trips(id),
  expert_id INTEGER NOT NULL REFERENCES expert_profiles(id),
  complainant_type VARCHAR(50) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  resolution TEXT,
  refund_amount DECIMAL(10, 2),
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX idx_disputes_booking ON expert_trip_disputes(booking_id);
CREATE INDEX idx_disputes_trip ON expert_trip_disputes(trip_id);
CREATE INDEX idx_disputes_status ON expert_trip_disputes(status);
