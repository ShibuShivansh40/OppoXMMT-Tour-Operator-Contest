const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Error] MONGODB_URI is not set in .env file!');
  process.exit(1);
}

async function runMigration() {
  console.log('[Database] Connecting to MongoDB Atlas...');
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('[Database] Connected successfully.');
    
    const db = client.db();
    const sourceCollection = db.collection('submissions_migrated');
    const backupCollectionName = `submissions_migrated_backup_${Date.now()}`;
    
    // 1. Create a server-side backup collection using aggregate $out
    console.log(`[Backup] Duplicating 'submissions_migrated' to '${backupCollectionName}'...`);
    await sourceCollection.aggregate([{ $out: backupCollectionName }]).toArray();
    console.log(`[Backup] Collection backup created successfully.`);

    // Check count to verify integrity
    const origCount = await sourceCollection.countDocuments();
    const backupCount = await db.collection(backupCollectionName).countDocuments();
    console.log(`[Backup Verify] Source Count: ${origCount}, Backup Count: ${backupCount}`);
    
    if (origCount !== backupCount) {
      throw new Error('Backup verification failed: document count mismatch.');
    }
    
    // 2. Iterate and update S3 URLs
    console.log('[Migration] Fetching submissions for URL updates...');
    const cursor = sourceCollection.find({});
    
    let processed = 0;
    let updated = 0;
    
    const oldPrefix = "oppo-mmt-media-bucket.s3.eu-north-1.amazonaws.com";
    const newPrefix = "oppoxmmt-tour-campaign-mumbai.s3.ap-south-1.amazonaws.com";
    
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      let isDocUpdated = false;
      
      if (doc.media_url && doc.media_url.includes(oldPrefix)) {
        doc.media_url = doc.media_url.replace(oldPrefix, newPrefix);
        isDocUpdated = true;
      }
      
      if (doc.thumbnail_url && doc.thumbnail_url.includes(oldPrefix)) {
        doc.thumbnail_url = doc.thumbnail_url.replace(oldPrefix, newPrefix);
        isDocUpdated = true;
      }
      
      if (isDocUpdated) {
        doc.updated_at = new Date();
        await sourceCollection.replaceOne({ _id: doc._id }, doc);
        updated++;
      }
      processed++;
    }
    
    console.log(`\n==================================================`);
    console.log(`  🚀 DB URL MIGRATION COMPLETED SUCCESSFULLY`);
    console.log(`  Backup Collection: ${backupCollectionName}`);
    console.log(`  Total Processed:    ${processed}`);
    console.log(`  Total URL Updates:  ${updated}`);
    console.log(`==================================================\n`);
    
  } catch (error) {
    console.error('[Error] Migration process encountered a failure:', error);
  } finally {
    await client.close();
    console.log('[Database] Connection closed.');
  }
}

runMigration();
