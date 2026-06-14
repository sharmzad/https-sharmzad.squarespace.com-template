-- EgyTravelMarket Database Schema

-- Users table for all accounts (customers, experts, agencies, admins)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  country VARCHAR(100),
  user_type VARCHAR(50) DEFAULT 'customer', -- customer, guide, diver, mentor, agency, admin
  approval_status VARCHAR(50) DEFAULT 'approved', -- pending, approved, rejected (for agencies and experts)
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expert profiles table for guides, divers, and mentors
CREATE TABLE IF NOT EXISTS expert_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expert_type VARCHAR(50) NOT NULL, -- guide, diver, mentor
  slug VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  bio TEXT,
  location VARCHAR(255),
  languages TEXT, -- JSON array
  specialties TEXT, -- JSON array
  certifications TEXT, -- JSON array
  experience_years INTEGER,
  profile_photo VARCHAR(500),
  cover_photo VARCHAR(500),
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  whatsapp VARCHAR(50),
  instagram VARCHAR(255),
  facebook VARCHAR(255),
  website VARCHAR(255),
  availability VARCHAR(50) DEFAULT 'available', -- available, busy, unavailable
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  bank_account_holder VARCHAR(255),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(255),
  bank_iban VARCHAR(100),
  bank_country VARCHAR(100),
  payment_setup_complete BOOLEAN DEFAULT false,
  license_number TEXT,
  license_issue_date DATE,
  license_expiry_date DATE,
  ministry_license_front_url TEXT,
  ministry_license_back_url TEXT,
  syndicate_license_front_url TEXT,
  syndicate_license_back_url TEXT,
  terms_accepted BOOLEAN DEFAULT false,
  license_confirmed BOOLEAN DEFAULT false,
  verification_consent BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMP,
  verification_status VARCHAR(50) DEFAULT 'pending',
  verified_at TIMESTAMP,
  verification_notes TEXT,
  certification_document_url TEXT,
  insurance_document_url TEXT,
  insurance_expiry_date DATE,
  diver_terms_agreement BOOLEAN DEFAULT false,
  diver_accuracy_confirmation BOOLEAN DEFAULT false,
  diver_verification_consent BOOLEAN DEFAULT false,
  mentor_role_agreement BOOLEAN DEFAULT false,
  mentor_terms_agreement BOOLEAN DEFAULT false,
  mentor_accuracy_confirmation BOOLEAN DEFAULT false,
  mentor_verification_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agency profiles table for travel agencies
CREATE TABLE IF NOT EXISTS agency_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  company_description TEXT,
  location VARCHAR(255),
  operating_areas TEXT, -- JSON array: ["Cairo", "Sharm El-Sheikh", "Hurghada"]
  services TEXT, -- JSON array: ["Tours", "Diving", "Hotels", "Transportation"]
  specialties TEXT, -- JSON array
  license_number VARCHAR(100),
  years_in_business INTEGER,
  logo_url VARCHAR(500),
  website_url VARCHAR(500),
  whatsapp VARCHAR(50),
  contact_email VARCHAR(255),
  facebook VARCHAR(255),
  instagram VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table for agencies and experts to post job opportunities
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  posted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poster_type VARCHAR(50) NOT NULL, -- 'agency' or 'expert'
  job_type VARCHAR(50) NOT NULL, -- 'guide', 'diver', 'mentor'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  employment_type VARCHAR(50), -- 'full-time', 'part-time', 'contract', 'seasonal'
  salary_min DECIMAL(10, 2),
  salary_max DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  salary_period VARCHAR(50), -- 'hourly', 'daily', 'monthly'
  requirements TEXT,
  benefits TEXT,
  start_date DATE,
  duration VARCHAR(100),
  contact_whatsapp VARCHAR(50),
  contact_email VARCHAR(255),
  application_deadline DATE,
  status VARCHAR(50) DEFAULT 'active', -- active, filled, expired, closed
  approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  view_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  expert_id INTEGER NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_message TEXT,
  status VARCHAR(50) DEFAULT 'applied', -- applied, viewed, contacted, rejected, hired
  viewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, expert_id)
);

-- Bookings table for all tour/package reservations
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  package_name VARCHAR(255) NOT NULL,
  package_type VARCHAR(100),
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50),
  guest_country VARCHAR(100),
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  pickup_location TEXT,
  special_requests TEXT,
  total_amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  booking_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_intent_id VARCHAR(255),
  checkout_session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table for payment records
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_method VARCHAR(50),
  stripe_payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flash offers table for promotional deals
CREATE TABLE IF NOT EXISTS flash_offers (
  id SERIAL PRIMARY KEY,
  badge VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  link VARCHAR(500),
  deadline TIMESTAMP NOT NULL,
  discount_percentage INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  message TEXT NOT NULL,
  subject VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Affiliate data table for Travelpayouts integration
CREATE TABLE IF NOT EXISTS affiliate_tracking (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  affiliate_source VARCHAR(100),
  commission_amount DECIMAL(10, 2),
  commission_currency VARCHAR(10) DEFAULT 'USD',
  travelpayouts_booking_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp click tracking table
CREATE TABLE IF NOT EXISTS whatsapp_clicks (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(50) NOT NULL,
  page_source VARCHAR(100) NOT NULL,
  user_ip VARCHAR(50),
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expert payouts tracking table
CREATE TABLE IF NOT EXISTS expert_payouts (
  id SERIAL PRIMARY KEY,
  expert_id INTEGER NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES expert_trip_bookings(id) ON DELETE CASCADE,
  trip_id INTEGER REFERENCES expert_trips(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, processing, paid, failed
  payment_method VARCHAR(50) DEFAULT 'bank_transfer', -- bank_transfer, stripe_payout
  stripe_payout_id VARCHAR(255),
  notes TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  processed_at TIMESTAMP,
  failed_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expert_payouts_expert ON expert_payouts(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_payouts_status ON expert_payouts(status);
CREATE INDEX IF NOT EXISTS idx_expert_payouts_booking ON expert_payouts(booking_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_expert_slug ON expert_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_expert_type ON expert_profiles(expert_type);
CREATE INDEX IF NOT EXISTS idx_expert_location ON expert_profiles(location);
CREATE INDEX IF NOT EXISTS idx_agency_slug ON agency_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_agency_location ON agency_profiles(location);
CREATE INDEX IF NOT EXISTS idx_agency_approval ON agency_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by ON jobs(posted_by);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_approval ON jobs(approval_status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_expert ON job_applications(expert_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(guest_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_flash_offers_active ON flash_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_service ON whatsapp_clicks(service_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_page ON whatsapp_clicks(page_source);
CREATE INDEX IF NOT EXISTS idx_whatsapp_date ON whatsapp_clicks(created_at);
