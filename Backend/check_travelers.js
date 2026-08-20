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
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.\n');
    
    const dbsList = await client.db().admin().listDatabases();
    console.log('--- Databases on the cluster ---');
    for (const dbInfo of dbsList.databases) {
      console.log(`\nDatabase: ${dbInfo.name}`);
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      for (const col of collections) {
        const colName = col.name;
        const count = await db.collection(colName).countDocuments({});
        console.log(`  - Collection: ${colName} (total records: ${count})`);
        
        try {
          const travelersCount = await db.collection(colName).countDocuments({ user_role: 'traveler' });
          if (travelersCount > 0) {
            const uniqueTravelers = await db.collection(colName).distinct('user_identifier', { user_role: 'traveler' });
            console.log(`    * Has traveler role: ${travelersCount} records, Unique traveler identifiers: ${uniqueTravelers.length}`);
            console.log('    * Unique travelers:', uniqueTravelers);
          }
        } catch (colErr) {
          // Some collections might not be structured similarly or could fail queries
        }
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
