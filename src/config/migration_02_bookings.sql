-- Migration: add bookings/inquiries table
-- Usage: psql -U postgres -d hostelfinder -f migration_02_bookings.sql

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    hostel_id INTEGER REFERENCES hostels(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(100),
    student_phone VARCHAR(20),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_hostel ON bookings (hostel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings (student_id);