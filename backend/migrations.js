/* eslint-disable no-console */
const { Client } = require('pg');

const migrationSql = `-- =========================================================
-- Dental Clinic Appointment Booking System (Multi-Clinic)
-- PostgreSQL Database Migrations
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- DROP TABLES (clean migration)
-- =========================================================
DROP VIEW IF EXISTS appointments_with_doctors;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_unavailability CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS clinics CASCADE;

-- =========================================================
-- CLINICS TABLE
-- =========================================================
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  logo TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  is_disabled BOOLEAN DEFAULT FALSE,
  opens_at TIME DEFAULT '09:00',
  closes_at TIME DEFAULT '16:00',
  slot_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE clinics IS 'Dental clinics (multi-tenant root table)';
COMMENT ON COLUMN clinics.domain IS 'Used to resolve clinic from request hostname';
COMMENT ON COLUMN clinics.logo IS 'Public logo image URL';
COMMENT ON COLUMN clinics.phone IS 'Primary clinic phone number';
COMMENT ON COLUMN clinics.email IS 'Primary clinic email';
COMMENT ON COLUMN clinics.address IS 'Clinic address';
COMMENT ON COLUMN clinics.is_disabled IS 'Disable online appointments';
COMMENT ON COLUMN clinics.opens_at IS 'Clinic opening time';
COMMENT ON COLUMN clinics.closes_at IS 'Clinic closing time';
COMMENT ON COLUMN clinics.slot_minutes IS 'Appointment slot duration in minutes';

-- =========================================================
-- DOCTORS TABLE
-- =========================================================
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  specialty VARCHAR(255) NOT NULL,
  description TEXT,
  avatar TEXT,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE doctors IS 'Doctors belonging to a specific clinic';
COMMENT ON COLUMN doctors.username IS 'Clinic login username';
COMMENT ON COLUMN doctors.description IS 'Optional doctor bio/summary';

-- =========================================================
-- DOCTOR UNAVAILABILITY
-- =========================================================
CREATE TABLE doctor_unavailability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE doctor_unavailability IS 'Doctor unavailable ranges and time blocks';

-- =========================================================
-- APPOINTMENTS TABLE
-- =========================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_appointment
    UNIQUE (clinic_id, doctor_id, date, time)
);

COMMENT ON TABLE appointments IS 'Patient appointment bookings';
COMMENT ON COLUMN appointments.completed IS 'Indicates if appointment was attended';

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX idx_unavailability_clinic_id ON doctor_unavailability(clinic_id);
CREATE INDEX idx_unavailability_doctor_id ON doctor_unavailability(doctor_id);
CREATE INDEX idx_unavailability_start_date ON doctor_unavailability(start_date);

CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_completed ON appointments(completed);
CREATE INDEX idx_appointments_patient_email ON appointments(patient_email);

-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- TRIGGERS
-- =========================================================
CREATE TRIGGER update_doctors_updated_at
BEFORE UPDATE ON doctors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- VIEW: APPOINTMENTS WITH DOCTOR INFO
-- =========================================================
CREATE OR REPLACE VIEW appointments_with_doctors AS
SELECT
  a.id,
  a.clinic_id,
  a.doctor_id,
  a.patient_name,
  a.patient_email,
  a.patient_phone,
  a.date,
  a.time,
  a.notes,
  a.completed,
  a.created_at,
  a.updated_at,
  d.name AS doctor_name,
  d.specialty AS doctor_specialty,
  d.avatar AS doctor_avatar
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
ORDER BY a.date ASC, a.time ASC;
`;

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = isProduction
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL (prod) or DATABASE_URL_DEV (dev).');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

async function runMigration() {
  try {
    await client.connect();
    await client.query(migrationSql);
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
