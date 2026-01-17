-- Bookings Table for StyleSync
-- Run this in your Supabase SQL Editor

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    client_name TEXT NOT NULL,
    service TEXT DEFAULT 'Appointment',
    booking_date TIMESTAMPTZ NOT NULL,
    duration INTEGER DEFAULT 60,  -- minutes
    notes TEXT,
    raw_message TEXT,  -- original SMS text for reference
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Create index for faster lookups
    CONSTRAINT bookings_user_email_idx UNIQUE (id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_email ON bookings(user_email);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON bookings(user_email, booking_date);

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_bookings_dedup ON bookings(user_email, client_name, booking_date);

-- Enable Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own bookings
CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT
    USING (true);  -- For now allow all, later add auth

-- Policy: Service role can insert
CREATE POLICY "Service role can insert bookings" ON bookings
    FOR INSERT
    WITH CHECK (true);

-- Policy: Service role can update
CREATE POLICY "Service role can update bookings" ON bookings
    FOR UPDATE
    USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data (optional - comment out in production)
-- INSERT INTO bookings (user_email, client_name, service, booking_date, notes)
-- VALUES
--     ('test@example.com', 'Jane Doe', 'Traditional Sew In', NOW() + INTERVAL '1 day', 'Regular client'),
--     ('test@example.com', 'Sarah Smith', 'Braids', NOW() + INTERVAL '2 days', 'New client');
