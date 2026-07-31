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
  
  const colName = 'submissions_migrated';
  console.log(`\n--- Scanning ${colName} for suspicious filenames/URLs ---`);
  
  // Find all records
  const records = await db.collection(colName).find({}).toArray();
  const suspicious = [];
  
  records.forEach(r => {
    const name = (r.file_name || '').toLowerCase();
    const url = (r.media_url || '').toLowerCase();
    
    // Check if filename contains other format substrings (heic, png, webp, gif, mp4, mov, avi)
    const indicators = ['heic', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi'];
    let flag = false;
    let matchedIndicator = '';
    
    for (const ind of indicators) {
      // We check if the indicator is present but the file ends with jpg/jpeg
      if (name.includes(ind) || url.includes(ind)) {
        flag = true;
        matchedIndicator = ind;
        break;
      }
    }
    
    if (flag) {
      suspicious.push({
        id: r.id,
        _id: r._id,
        file_name: r.file_name,
        media_url: r.media_url,
        indicator: matchedIndicator,
        created_at: r.created_at
      });
    }
  });
  
  console.log(`Total records checked: ${records.length}`);
  console.log(`Suspicious records found: ${suspicious.length}`);
  if (suspicious.length > 0) {
    suspicious.forEach(s => {
      console.log(`- ID: ${s.id}, File: ${s.file_name}, URL: ${s.media_url}, Match: ${s.indicator}, Created: ${s.created_at}`);
    });
  }
  
  await client.close();
}

main().catch(console.error);
