// Bypass SSL validation for local proxies/firewalls
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { MongoClient } = require('mongodb');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const Jimp = require('jimp');
const JPEG = require('d:/Client Work/Creative Catalysts [Hans Bellani]/OppoxMMT Tour Contest/Backend/node_modules/jpeg-js');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Override Jimp JPEG decoder memory limit to 1024MB to handle high-resolution photos
Jimp.decoders['image/jpeg'] = (data) => JPEG.decode(data, { maxMemoryUsageInMB: 1024 });

const MONGODB_URI = process.env.MONGODB_URI;
const BUCKET_NAME = 'oppoxmmt-tour-campaign-mumbai';
const REGION = 'ap-south-1';

if (!MONGODB_URI) {
  console.error('[Error] MONGODB_URI is not set in .env!');
  process.exit(1);
}

// ---------------------------------------------------------
// WORKER THREAD LOGIC (Executes on background CPU cores)
// ---------------------------------------------------------
if (!isMainThread) {
  const { docChunk, workerId } = workerData;
  
  const s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  function getS3KeyFromUrl(url) {
    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname.substring(1));
    } catch (e) {
      return null;
    }
  }

  function getThumbnailKey(key) {
    const parts = key.split('/');
    const fileName = parts.pop();
    const dashIndex = fileName.indexOf('-');
    if (dashIndex !== -1) {
      const timestamp = fileName.substring(0, dashIndex);
      const originalName = fileName.substring(dashIndex + 1);
      return [...parts, `${timestamp}-thumb_${originalName}`].join('/');
    } else {
      return [...parts, `thumb_${fileName}`].join('/');
    }
  }

  async function startWorker() {
    const client = new MongoClient(MONGODB_URI);
    try {
      await client.connect();
      const db = client.db();
      const collection = db.collection('submissions_migrated');
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < docChunk.length; i++) {
        const doc = docChunk[i];
        const key = getS3KeyFromUrl(doc.media_url);
        
        if (!key) {
          failCount++;
          continue;
        }
        
        const thumbKey = getThumbnailKey(key);
        const newThumbUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${thumbKey}`;
        
        try {
          // 1. Download original from S3
          const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
          const response = await s3Client.send(getCmd);
          const buffer = await streamToBuffer(response.Body);
          
          // 2. Resize and compress maintaining aspect ratio
          const image = await Jimp.read(buffer);
          
          const maxWidth = 300;
          const maxHeight = 300;
          let w = image.bitmap.width;
          let h = image.bitmap.height;
          
          if (w > h) {
            if (w > maxWidth) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            }
          } else {
            if (h > maxHeight) {
              w = Math.round((w * maxHeight) / h);
              h = maxHeight;
            }
          }
          
          image.resize(w, h);
          image.quality(70);
          const thumbBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
          
          // 3. Upload thumbnail to S3
          const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: 'image/jpeg',
            ACL: 'public-read'
          });
          await s3Client.send(putCmd);
          
          // 4. Update MongoDB record (matching by the unique integer id)
          await collection.updateOne(
            { id: doc.id },
            { 
              $set: { 
                thumbnail_url: newThumbUrl,
                updated_at: new Date()
              } 
            }
          );
          
          successCount++;
          // Report progress back to main thread
          parentPort.postMessage({ type: 'progress', docId: doc.id, fileName: doc.file_name });
          
        } catch (err) {
          failCount++;
          parentPort.postMessage({ type: 'error', docId: doc.id, fileName: doc.file_name, error: err.message });
        }
      }
      
      parentPort.postMessage({ type: 'done', successCount, failCount });
      await client.close();
    } catch (err) {
      parentPort.postMessage({ type: 'fatal', error: err.message });
    }
  }
  
  startWorker();
}

// ---------------------------------------------------------
// MAIN COORDINATOR THREAD
// ---------------------------------------------------------
if (isMainThread) {
  async function main() {
    console.log(`=== Starting Multi-Threaded S3 Thumbnail Generation ===`);
    console.log(`Bucket: ${BUCKET_NAME} | Region: ${REGION}`);
    
    const client = new MongoClient(MONGODB_URI);
    
    try {
      await client.connect();
      console.log('[MongoDB] Connected successfully.');
      const db = client.db();
      const collection = db.collection('submissions_migrated');
      
      // Find all images missing thumbnails (exclude mp4, mov, avi, webm)
      const query = {
        file_name: { $regex: /\.(jpg|jpeg|png|webp)$/i },
        $or: [
          { thumbnail_url: { $exists: false } },
          { thumbnail_url: null },
          { thumbnail_url: "" },
          { $expr: { $eq: ["$thumbnail_url", "$media_url"] } }
        ]
      };
      
      const docs = await collection.find(query).toArray();
      console.log(`[MongoDB] Found ${docs.length} submissions needing thumbnails.`);
      
      if (docs.length === 0) {
        console.log('✅ No submissions need thumbnails.');
        await client.close();
        return;
      }
      
      await client.close(); // Close coordinator connection to avoid leaking sockets
      
      // Calculate chunks for worker threads
      const numCores = Math.min(os.cpus().length || 4, 8); // Use up to 8 threads depending on CPU
      console.log(`[Main] Spawning ${numCores} worker threads...`);
      
      const chunks = Array.from({ length: numCores }, () => []);
      docs.forEach((doc, idx) => {
        chunks[idx % numCores].push(doc);
      });
      
      let completedCount = 0;
      let totalSuccess = 0;
      let totalFailed = 0;
      let finishedWorkers = 0;
      
      const startTime = Date.now();
      
      const workers = chunks.map((chunk, id) => {
        if (chunk.length === 0) {
          finishedWorkers++;
          return null;
        }
        
        const worker = new Worker(__filename, {
          workerData: { docChunk: chunk, workerId: id + 1 }
        });
        
        worker.on('message', (msg) => {
          if (msg.type === 'progress') {
            completedCount++;
            const pct = ((completedCount / docs.length) * 100).toFixed(1);
            console.log(`[Progress] ${completedCount}/${docs.length} (${pct}%) - Created thumbnail for ID: ${msg.docId} (${msg.fileName})`);
          } else if (msg.type === 'error') {
            completedCount++;
            const pct = ((completedCount / docs.length) * 100).toFixed(1);
            console.error(`[Error] ${completedCount}/${docs.length} (${pct}%) - Failed for ID: ${msg.docId} (${msg.fileName}): ${msg.error}`);
          } else if (msg.type === 'done') {
            totalSuccess += msg.successCount;
            totalFailed += msg.failCount;
            finishedWorkers++;
            
            if (finishedWorkers === numCores) {
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`\n========================================`);
              console.log(`🎉 Multi-Threaded Migration Completed.`);
              console.log(`Total Success: ${totalSuccess}`);
              console.log(`Total Failed:  ${totalFailed}`);
              console.log(`Time Elapsed:  ${duration}s`);
              console.log(`========================================`);
            }
          } else if (msg.type === 'fatal') {
            console.error(`[Worker ${id + 1} Fatal Error]: ${msg.error}`);
          }
        });
        
        worker.on('error', (err) => {
          console.error(`[Worker ${id + 1} System Error]:`, err);
        });
        
        return worker;
      }).filter(Boolean);
      
    } catch (error) {
      console.error('[Error] Coordinator execution failed:', error);
    }
  }
  
  main();
}
