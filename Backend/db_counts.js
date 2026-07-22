const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');
  
  const submissionsCount = await db.collection('submissions').countDocuments({});
  const submissionsMigratedCount = await db.collection('submissions_migrated').countDocuments({});
  
  console.log(`Collection 'submissions' count: ${submissionsCount}`);
  console.log(`Collection 'submissions_migrated' count: ${submissionsMigratedCount}`);
  
  await client.close();
}

main().catch(console.error);
