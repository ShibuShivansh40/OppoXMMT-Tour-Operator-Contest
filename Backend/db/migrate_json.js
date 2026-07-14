const fs = require('fs');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runJsonMigration() {
  console.log('=== Starting database migration from JSON Backup to MongoDB Atlas ===');

  const mongoConfigured = !!process.env.MONGODB_URI;
  if (!mongoConfigured) {
    console.error('Error: MONGODB_URI is missing in .env');
    process.exit(1);
  }

  const backupPath = 'C:/Users/seths/Downloads/submissions.json';
  if (!fs.existsSync(backupPath)) {
    console.error(`Error: Backup file not found at ${backupPath}`);
    console.error('Please save your memory data by visiting http://localhost:8080/api/submissions and saving the page as submissions.json in the Backend folder.');
    process.exit(1);
  }

  let backupData;
  try {
    const rawContent = fs.readFileSync(backupPath, 'utf8');
    const parsed = JSON.parse(rawContent);
    backupData = parsed.data || parsed; // Handles both raw array and wrapper object
  } catch (err) {
    console.error('Error reading/parsing submissions.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(backupData) || backupData.length === 0) {
    console.log('No submissions found in backup file. Nothing to migrate.');
    return;
  }

  const mongoClient = new MongoClient(process.env.MONGODB_URI);

  try {
    console.log('[MongoDB] Connecting to cluster...');
    await mongoClient.connect();
    const db = mongoClient.db();
    const collection = db.collection('submissions_migrated');

    console.log('[MongoDB] Cleared existing submissions in collection...');
    await collection.deleteMany({}); // Clears collection to avoid duplicate entries

    // Map rows to MongoDB documents
    const documents = backupData.map(item => {
      return {
        id: parseInt(item.id, 10),
        user_identifier: item.user_identifier,
        user_role: item.user_role,
        media_url: item.media_url,
        file_name: item.file_name,
        file_size: parseInt(item.file_size, 10),
        location: item.location,
        travel_date: item.travel_date ? item.travel_date.split('T')[0] : null,
        full_name: item.full_name || null,
        tour_manager: item.tour_manager || null,
        device: item.device || null,
        insta_handle: item.insta_handle || null,
        status: item.status || 'pending',
        is_winner: !!item.is_winner,
        winner_selected_at: item.winner_selected_at ? new Date(item.winner_selected_at) : null,
        score_composition: item.score_composition !== null && item.score_composition !== undefined ? parseInt(item.score_composition, 10) : null,
        score_watermark: item.score_watermark !== null && item.score_watermark !== undefined ? parseInt(item.score_watermark, 10) : null,
        score_location: item.score_location !== null && item.score_location !== undefined ? parseInt(item.score_location, 10) : null,
        score_engagement: item.score_engagement !== null && item.score_engagement !== undefined ? parseInt(item.score_engagement, 10) : null,
        score_consistency: item.score_consistency !== null && item.score_consistency !== undefined ? parseInt(item.score_consistency, 10) : null,
        score_total: item.score_total !== null && item.score_total !== undefined ? parseInt(item.score_total, 10) : null,
        created_at: item.created_at ? new Date(item.created_at) : new Date(),
        updated_at: item.updated_at ? new Date(item.updated_at) : new Date()
      };
    });

    console.log(`[MongoDB] Inserting ${documents.length} documents into 'submissions' collection...`);
    const insertRes = await collection.insertMany(documents);
    console.log(`✅ Success! Migrated ${insertRes.insertedCount} records successfully.`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await mongoClient.close();
    console.log('Connections closed.');
  }
}

runJsonMigration();
