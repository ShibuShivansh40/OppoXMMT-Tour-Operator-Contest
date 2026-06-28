-- PostgreSQL Schema Initialization for OPPO x MMT UGC Campaign

-- Enable UUID extension if needed in the future
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table structure for campaign submissions
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    user_identifier VARCHAR(100) NOT NULL,          -- Phone number for Traveler, Operator code for Operator
    user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('traveler', 'operator')),
    media_url VARCHAR(512) NOT NULL,                -- Target location in S3 bucket
    file_name VARCHAR(255) NOT NULL,                -- Original filename
    file_size INTEGER NOT NULL,                     -- Size in bytes
    location VARCHAR(150) NOT NULL,                 -- Destination or site location
    travel_date DATE NOT NULL,                      -- Date of travel / photoshoot
    full_name VARCHAR(150) DEFAULT NULL,            -- Full Name of the traveler
    tour_manager VARCHAR(150) DEFAULT NULL,         -- Tour operator / manager name
    device VARCHAR(100) DEFAULT NULL,               -- Smartphone device used
    insta_handle VARCHAR(100) DEFAULT NULL,         -- Instagram handle
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    is_winner BOOLEAN DEFAULT FALSE,                -- Selected as winner by OPPO client
    winner_selected_at TIMESTAMP WITH TIME ZONE,     -- When winner status was set
    score_composition INTEGER DEFAULT NULL,
    score_watermark INTEGER DEFAULT NULL,
    score_location INTEGER DEFAULT NULL,
    score_engagement INTEGER DEFAULT NULL,
    score_consistency INTEGER DEFAULT NULL,
    score_total INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for fast search and aggregation
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_location ON submissions(location);
CREATE INDEX IF NOT EXISTS idx_submissions_user_role ON submissions(user_role);
CREATE INDEX IF NOT EXISTS idx_submissions_is_winner ON submissions(is_winner);

-- Simple trigger function to update updated_at timestamp on edit
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_submissions_modtime
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
