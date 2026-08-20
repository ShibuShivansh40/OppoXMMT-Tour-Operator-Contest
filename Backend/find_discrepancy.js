const { MongoClient } = require('mongodb');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'oppoxmmt-tour-campaign-mumbai';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined in env');
    return;
  }
  
  // 1. Get unique travelers from S3
  const s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  });

  const s3Travelers = new Set();
  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    });
    const response = await s3Client.send(command);
    if (response.Contents) {
      for (const obj of response.Contents) {
        const parts = obj.Key.split('/');
        if (parts[0] === 'ugc-campaign' && parts[1] === 'traveler' && parts[2]) {
          // Normalize to + format
          let identifier = parts[2];
          if (!identifier.startsWith('+')) {
            identifier = '+' + identifier;
          }
          s3Travelers.add(identifier);
        }
      }
    }
    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  const s3TravelersArray = Array.from(s3Travelers).sort();

  // 2. Get unique travelers from MongoDB 'submissions_migrated'
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');
  
  const dbTravelers = await db.collection('submissions_migrated').distinct('user_identifier', { user_role: 'traveler' });
  const dbTravelersSet = new Set(dbTravelers);

  console.log(`\nS3 Unique Travelers count (normalized with +): ${s3TravelersArray.length}`);
  console.log(`DB Unique Travelers count: ${dbTravelersSet.size}`);

  // 3. Find S3 travelers missing from DB
  const missingFromDb = [];
  for (const trav of s3TravelersArray) {
    if (!dbTravelersSet.has(trav)) {
      missingFromDb.push(trav);
    }
  }

  console.log('\n--- Travelers in S3 but MISSING from MongoDB submissions_migrated ---');
  if (missingFromDb.length === 0) {
    console.log('None! All travelers in S3 are also in the DB.');
  } else {
    for (const trav of missingFromDb) {
      // Check if they exist in DB under a different role, or in any other collection
      const inDbAnyRole = await db.collection('submissions_migrated').findOne({ user_identifier: trav });
      const inDbWithoutPlus = await db.collection('submissions_migrated').findOne({ user_identifier: trav.substring(1) });
      const inSub = await db.collection('submissions').findOne({ user_identifier: trav });
      
      console.log(`- ${trav}:`);
      if (inDbAnyRole) {
        console.log(`  * Exists in submissions_migrated under role: "${inDbAnyRole.user_role}"`);
      } else if (inDbWithoutPlus) {
        console.log(`  * Exists in submissions_migrated as identifier without plus: "${trav.substring(1)}" with role "${inDbWithoutPlus.user_role}"`);
      } else {
        console.log(`  * DOES NOT exist in submissions_migrated at all.`);
      }
      
      if (inSub) {
        console.log(`  * Exists in old 'submissions' collection under role: "${inSub.user_role}"`);
      }
    }
  }

  // 4. Find DB travelers missing from S3
  const missingFromS3 = [];
  for (const trav of dbTravelers) {
    if (!s3Travelers.has(trav)) {
      missingFromS3.push(trav);
    }
  }

  console.log('\n--- Travelers in MongoDB submissions_migrated but MISSING from S3 ---');
  if (missingFromS3.length === 0) {
    console.log('None! All travelers in DB have uploads in S3.');
  } else {
    for (const trav of missingFromS3) {
      console.log(`- ${trav}`);
    }
  }

  await client.close();
}

main().catch(console.error);
