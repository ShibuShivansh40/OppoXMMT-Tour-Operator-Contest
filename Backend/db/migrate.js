const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  console.log('=== Starting database migration from PostgreSQL to MongoDB Atlas ===');

  const pgConfigured = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME;
  const mongoConfigured = !!process.env.MONGODB_URI;

  if (!pgConfigured) {
    console.error('Error: PostgreSQL environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) are missing in .env');
    process.exit(1);
  }

  if (!mongoConfigured) {
    console.error('Error: MONGODB_URI is missing in .env');
    process.exit(1);
  }

  // Connect to PostgreSQL
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Connect to MongoDB
  const mongoClient = new MongoClient(process.env.MONGODB_URI);

  try {
    console.log('[PostgreSQL] Connecting...');
    const pgRes = await pool.query('SELECT * FROM submissions ORDER BY id ASC');
    console.log(`[PostgreSQL] Successfully fetched ${pgRes.rowCount} submission records.`);

    if (pgRes.rowCount === 0) {
      console.log('No submissions found in PostgreSQL. Nothing to migrate.');
      return;
    }

    console.log('[MongoDB] Connecting to cluster...');
    await mongoClient.connect();
    const db = mongoClient.db();
    const collection = db.collection('submissions');

    console.log('[MongoDB] Cleared existing submissions in collection...');
    await collection.deleteMany({}); // Clears collection to avoid duplicate entries

    // Map rows to MongoDB documents
    const documents = pgRes.rows.map(row => {
      return {
        id: parseInt(row.id, 10),
        user_identifier: row.user_identifier,
        user_role: row.user_role,
        media_url: row.media_url,
        file_name: row.file_name,
        file_size: parseInt(row.file_size, 10),
        location: row.location,
        travel_date: row.travel_date ? new Date(row.travel_date).toISOString().split('T')[0] : null,
        full_name: row.full_name || null,
        tour_manager: row.tour_manager || null,
        device: row.device || null,
        insta_handle: row.insta_handle || null,
        status: row.status || 'pending',
        is_winner: !!row.is_winner,
        winner_selected_at: row.winner_selected_at ? new Date(row.winner_selected_at) : null,
        score_composition: row.score_composition !== null ? parseInt(row.score_composition, 10) : null,
        score_watermark: row.score_watermark !== null ? parseInt(row.score_watermark, 10) : null,
        score_location: row.score_location !== null ? parseInt(row.score_location, 10) : null,
        score_engagement: row.score_engagement !== null ? parseInt(row.score_engagement, 10) : null,
        score_consistency: row.score_consistency !== null ? parseInt(row.score_consistency, 10) : null,
        score_total: row.score_total !== null ? parseInt(row.score_total, 10) : null,
        created_at: row.created_at ? new Date(row.created_at) : new Date(),
        updated_at: row.updated_at ? new Date(row.updated_at) : new Date()
      };
    });

    console.log(`[MongoDB] Inserting ${documents.length} documents into 'submissions' collection...`);
    const insertRes = await collection.insertMany(documents);
    console.log(`✅ Success! Migrated ${insertRes.insertedCount} records successfully.`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
    await mongoClient.close();
    console.log('Connections closed.');
  }
}

runMigration();
