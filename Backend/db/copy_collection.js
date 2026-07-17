const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

async function copyCollection() {
  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.');
    const db = client.db();
    
    const srcColl = db.collection('submissions_migrated');
    const destColl = db.collection('submissions');
    
    const count = await srcColl.countDocuments({});
    console.log(`Source collection 'submissions_migrated' contains ${count} documents.`);
    
    if (count === 0) {
      console.log('No documents to copy.');
      return;
    }
    
    console.log('Clearing destination collection "submissions"...');
    await destColl.deleteMany({});
    
    console.log('Copying documents...');
    const docs = await srcColl.find({}).toArray();
    const result = await destColl.insertMany(docs);
    console.log(`Successfully copied ${result.insertedCount} documents to collection "submissions"!`);
  } catch (err) {
    console.error('Error during collection copy:', err.message);
  } finally {
    await client.close();
  }
}

copyCollection();
