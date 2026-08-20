const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'oppoxmmt-tour-campaign-mumbai';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  const s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  });

  const targets = ['917347239669', '917876087770', '919821498914'];

  for (const t of targets) {
    console.log(`\n================ Details for ${t} in S3 ================`);
    
    // Check traveler folder
    let isTruncated = true;
    let continuationToken = undefined;
    let files = [];

    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: `ugc-campaign/traveler/${t}/`,
        ContinuationToken: continuationToken,
      });
      const response = await s3Client.send(command);
      if (response.Contents) {
        files.push(...response.Contents);
      }
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }

    console.log(`Traveler uploads in S3: ${files.length} files`);
    files.forEach(f => {
      console.log(`- Key: ${f.Key}`);
      console.log(`  LastModified: ${f.LastModified}`);
      console.log(`  Size: ${(f.Size / 1024 / 1024).toFixed(3)} MB`);
    });

    // Check operator folder
    isTruncated = true;
    continuationToken = undefined;
    let opFiles = [];
    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: `ugc-campaign/operator/${t}/`,
        ContinuationToken: continuationToken,
      });
      const response = await s3Client.send(command);
      if (response.Contents) {
        opFiles.push(...response.Contents);
      }
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }
    
    if (opFiles.length > 0) {
      console.log(`Operator uploads in S3: ${opFiles.length} files`);
      opFiles.forEach(f => {
        console.log(`- Key: ${f.Key}`);
        console.log(`  LastModified: ${f.LastModified}`);
      });
    }
  }
}

main().catch(console.error);
