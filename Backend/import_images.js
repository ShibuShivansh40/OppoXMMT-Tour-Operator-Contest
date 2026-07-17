const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { MongoClient } = require('mongodb');
const { s3Client } = require('./config/s3');
require('dotenv').config();

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'oppo-mmt-media-bucket';
const REGION = process.env.AWS_REGION || 'eu-north-1';
const MONGODB_URI = process.env.MONGODB_URI;

const TARGET_DIRECTORIES = [
  'C:\\Users\\seths\\Downloads\\Oppo-1',
  'C:\\Users\\seths\\Downloads\\Oppo-2',
  'C:\\Users\\seths\\Downloads\\Oppo-3'
];

// Helper: Get content type from extension
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return 'application/octet-stream';
}

// Helper: Parse Date from filename (e.g. WhatsApp Image 2026-06-22 ...)
function parseDateFromFilename(filename) {
  const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return dateMatch[0]; // returns YYYY-MM-DD
  }
  return '2026-07-17'; // default to today's local date
}

// Helper: Scan directory recursively for image/video files
function getFilesRecursive(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.warn(`[Warning] Directory not found: ${dir}`);
    return fileList;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFilesRecursive(fullPath, fileList);
    } else {
      const ext = file.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// Main execution
async function main() {
  if (!MONGODB_URI) {
    console.error('[Error] MONGODB_URI missing in environment config.');
    process.exit(1);
  }
  if (!s3Client) {
    console.error('[Error] S3 Client is not initialized or configured.');
    process.exit(1);
  }

  console.log('[Info] Connecting to MongoDB Atlas...');
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  const db = mongoClient.db();
  const collection = db.collection('submissions_migrated');
  console.log('[Info] Connected to MongoDB database successfully.');

  // Get current last numeric id
  const lastDoc = await collection.findOne({}, { sort: { id: -1 } });
  let nextId = lastDoc ? lastDoc.id + 1 : 1;

  // Scan all target directories
  let allFiles = [];
  for (const dir of TARGET_DIRECTORIES) {
    console.log(`[Info] Scanning directory: ${dir}...`);
    getFilesRecursive(dir, allFiles);
  }
  console.log(`[Info] Found ${allFiles.length} media files to migrate.`);

  let successCount = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const filepath = allFiles[i];
    const filename = path.basename(filepath);
    const filesize = fs.statSync(filepath).size;

    console.log(`\n----------------------------------------`);
    console.log(`[${i + 1}/${allFiles.length}] Processing: ${filename}`);

    // Parse directory structure to extract details
    // Structure: ...\Oppo\<TourManagerName>\<Month>\<Location>\<PhotosOrVideos>\<FileName>
    const normalizedPath = path.normalize(filepath);
    const pathElements = normalizedPath.split(path.sep);
    const oppoIndex = pathElements.findIndex(el => el.toLowerCase() === 'oppo');

    let tourManagerName = 'NA';
    let travelMonth = 'NA';
    let location = 'NA';

    if (oppoIndex !== -1 && oppoIndex + 3 < pathElements.length) {
      tourManagerName = pathElements[oppoIndex + 1] || 'NA';
      travelMonth = pathElements[oppoIndex + 2] || 'NA';
      location = pathElements[oppoIndex + 3] || 'NA';
    }

    const travelDate = parseDateFromFilename(filename);
    const contentType = getContentType(filename);
    const objectKey = `ugc-campaign/migrated-${Date.now()}-${filename}`;

    console.log(`[Info] Extracted Metadata:`);
    console.log(`  Tour Manager: ${tourManagerName}`);
    console.log(`  Location    : ${location}`);
    console.log(`  Travel Date : ${travelDate}`);
    console.log(`  Month       : ${travelMonth}`);
    console.log(`  Size        : ${(filesize / (1024 * 1024)).toFixed(2)} MB`);

    try {
      // 1. Upload file binary to S3
      console.log(`[S3] Uploading file to bucket '${BUCKET_NAME}' key '${objectKey}'...`);
      const fileBuffer = fs.readFileSync(filepath);
      const s3Command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        ContentType: contentType,
        Body: fileBuffer,
        ACL: 'public-read'
      });
      await s3Client.send(s3Command);
      
      const mediaUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${objectKey}`;
      console.log(`[S3] Upload successful. S3 URL: ${mediaUrl}`);

      // 2. Insert record into MongoDB
      const record = {
        id: nextId++,
        user_identifier: tourManagerName !== 'NA' ? tourManagerName : 'MIGRATED_TM',
        user_role: 'operator', // Migrated under Tour Manager
        media_url: mediaUrl,
        file_name: filename,
        file_size: filesize,
        location: location,
        travel_date: travelDate,
        full_name: tourManagerName,
        tour_manager: tourManagerName,
        device: 'Oppo Phone', // Kept as Oppo Phone
        insta_handle: 'NA',
        status: 'approved', // Pre-approved so it renders in showcase
        is_winner: false,
        winner_selected_at: null,
        score_composition: null,
        score_watermark: null,
        score_location: null,
        score_engagement: null,
        score_consistency: null,
        score_total: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      await collection.insertOne(record);
      console.log(`[Database] Submissions record inserted with ID #${record.id}.`);
      successCount++;
    } catch (err) {
      console.error(`[Error] Failed to process ${filename}:`, err.message);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Summary] Successfully uploaded ${successCount}/${allFiles.length} files to S3 & recorded in Database.`);
  await mongoClient.close();
  console.log('[Info] MongoDB connection closed. Migration finished.');
}

main().catch(console.error);
