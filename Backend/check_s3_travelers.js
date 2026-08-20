const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'oppoxmmt-tour-campaign-mumbai';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('AWS Credentials missing in environment configuration.');
    return;
  }

  const s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  });

  console.log(`Connecting to S3 Bucket: ${BUCKET_NAME} (${REGION})...\n`);

  let uniqueTravelers = new Set();
  let uniqueOperators = new Set();
  let totalObjects = 0;
  let travelerObjectsCount = 0;
  let operatorObjectsCount = 0;
  let migratedObjectsCount = 0;
  let otherKeys = [];

  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    if (response.Contents) {
      totalObjects += response.Contents.length;
      for (const obj of response.Contents) {
        const key = obj.Key;
        // Check key pattern: ugc-campaign/{userRole}/{userIdentifier}/...
        const parts = key.split('/');
        if (parts[0] === 'ugc-campaign') {
          if (parts[1] === 'traveler') {
            travelerObjectsCount++;
            if (parts[2]) {
              uniqueTravelers.add(parts[2]);
            }
          } else if (parts[1] === 'operator') {
            operatorObjectsCount++;
            if (parts[2]) {
              uniqueOperators.add(parts[2]);
            }
          } else if (parts[1] && parts[1].startsWith('migrated-')) {
            migratedObjectsCount++;
          } else {
            otherKeys.push(key);
          }
        } else {
          otherKeys.push(key);
        }
      }
    }
    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  console.log('--- S3 Bucket Stats ---');
  console.log(`Total Objects in Bucket: ${totalObjects}`);
  console.log(`Traveler Uploads: ${travelerObjectsCount}`);
  console.log(`Operator Uploads: ${operatorObjectsCount}`);
  console.log(`Migrated Uploads: ${migratedObjectsCount}`);
  console.log(`Other/Unclassified Keys count: ${otherKeys.length}`);
  
  console.log(`\nUnique Traveler Identifiers in S3 (${uniqueTravelers.size}):`);
  const sortedTravelers = Array.from(uniqueTravelers).sort();
  sortedTravelers.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t}`);
  });

  console.log(`\nUnique Operator Identifiers in S3 (${uniqueOperators.size}):`);
  const sortedOperators = Array.from(uniqueOperators).sort();
  sortedOperators.forEach((o, i) => {
    console.log(`  ${i + 1}. ${o}`);
  });
}

main().catch(console.error);
