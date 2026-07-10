const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const isS3Configured = process.env.S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

let s3Client = null;

if (isS3Configured) {
  console.log('[S3] AWS S3 Configuration detected. Initializing S3 Client...');
  s3Client = new S3Client({
    region: (process.env.AWS_REGION && process.env.AWS_REGION.trim()) || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  });
} else {
  console.warn('[S3] S3 credentials missing. S3 Client operating in MOCK MODE.');
}

/**
 * Generate a pre-signed URL for direct upload to S3.
 * Falls back to generating a mock upload endpoint if S3 credentials are not set.
 */
async function generatePresignedUploadUrl(fileName, fileType, customObjectKey) {
  const bucketName = (process.env.S3_BUCKET_NAME && process.env.S3_BUCKET_NAME.trim()) || 'oppo-mmt-media-bucket';
  const objectKey = customObjectKey || `ugc-campaign/${Date.now()}-${fileName}`;

  if (s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: fileType,
        ACL: 'public-read',
      });

      // URL valid for 15 minutes (900 seconds)
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      const region = (process.env.AWS_REGION && process.env.AWS_REGION.trim()) || 'ap-south-1';
      const mediaUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`;

      return {
        isMock: false,
        uploadUrl: presignedUrl,
        mediaUrl: mediaUrl,
        objectKey: objectKey
      };
    } catch (err) {
      console.error('[S3] Error generating real S3 pre-signed URL:', err.message);
      return getMockUploadDetails(fileName, bucketName, objectKey);
    }
  } else {
    return getMockUploadDetails(fileName, bucketName, objectKey);
  }
}

/**
 * Returns mock upload credentials and URLs for offline testing.
 */
function getMockUploadDetails(fileName, bucketName, objectKey) {
  const localPort = process.env.PORT || 8080;
  // If no S3, we point to a mock endpoint on the local server that simulates the PUT request
  return {
    isMock: true,
    uploadUrl: `http://localhost:${localPort}/api/upload/mock-s3-put?key=${encodeURIComponent(objectKey)}`,
    mediaUrl: `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 1000)}`, // Returns high-quality random image for local visuals
    objectKey: objectKey
  };
}

async function getSignedDownloadUrl(mediaUrl) {
  if (!s3Client || !mediaUrl || !mediaUrl.includes('amazonaws.com')) {
    return mediaUrl;
  }
  try {
    const urlObj = new URL(mediaUrl);
    // Pathname starts with '/', so remove leading '/' to get key
    const objectKey = decodeURIComponent(urlObj.pathname.substring(1));
    const bucketName = process.env.S3_BUCKET_NAME || 'oppo-mmt-media-bucket';

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    // Valid for 15 minutes (900 seconds)
    return await getSignedUrl(s3Client, command, { expiresIn: 900 });
  } catch (err) {
    console.error('[S3] Error generating pre-signed GET URL:', err.message);
    return mediaUrl;
  }
}

module.exports = {
  s3Client,
  generatePresignedUploadUrl,
  getSignedDownloadUrl
};
