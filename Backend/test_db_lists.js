const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to Atlas.');
  
  // List all databases
  const dbs = await client.db().admin().listDatabases();
  console.log('Databases in cluster:');
  for (const dbInfo of dbs.databases) {
    console.log(`- ${dbInfo.name}`);
    const db = client.db(dbInfo.name);
    const cols = await db.listCollections().toArray();
    console.log(`  Collections: ${cols.map(c => c.name).join(', ')}`);
  }
  await client.close();
}

main().catch(console.error);
