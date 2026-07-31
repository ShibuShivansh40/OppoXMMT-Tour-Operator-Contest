const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined in env');
    return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');
  
  const records = await db.collection('submissions_migrated')
    .find({})
    .sort({ id: -1 })
    .limit(50)
    .toArray();
    
  console.log('Most recent 50 records in submissions_migrated:');
  records.forEach(r => {
    console.log(`- ID: ${r.id}, Name: ${r.file_name}, URL: ${r.media_url}, Created At: ${r.created_at}`);
  });
  
  await client.close();
}

main().catch(console.error);
