const s3 = require('../config/s3');

/**
 * Request a pre-signed URL for direct S3 uploads.
 * POST /api/upload/presigned-url
 * Body: { fileName, fileType, fileSize, userRole }
 */
async function getPresignedUrl(req, res) {
  try {
    const { fileName, fileType: rawFileType, fileSize, userRole, userIdentifier } = req.body;

    // Sanitize fileType - fallback to 'application/octet-stream' if empty/missing
    // (can happen for uncommon MIME types on mobile/Android browsers)
    const fileType = (rawFileType && rawFileType.trim()) ? rawFileType.trim() : 'application/octet-stream';

    // 1. Basic validation
    if (!fileName || !rawFileType || !fileSize || !userRole) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: fileName, fileType, fileSize, userRole'
      });
    }

    if (userRole !== 'traveler' && userRole !== 'operator') {
      return res.status(400).json({
        success: false,
        message: "Invalid userRole. Must be 'traveler' or 'operator'"
      });
    }

    // 2. Validate file size limits
    const limitMB = userRole === 'traveler' ? 10 : 15;
    const limitBytes = limitMB * 1024 * 1024;

    if (fileSize > limitBytes) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds the allowable limit of ${limitMB}MB for ${userRole} uploads.`
      });
    }

    // 3. Validate file types (images or videos)
    // Note: 'application/octet-stream' is a valid fallback for files where browser returns empty MIME type
    const allowedPrefixes = ['image/', 'video/', 'application/octet-stream'];
    const isAllowedType = allowedPrefixes.some(prefix => fileType.toLowerCase().startsWith(prefix));

    if (!isAllowedType) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type. Only image and video uploads are permitted.'
      });
    }

    // 4. Build Structured Cloud Folder Path
    // segment format: ugc-campaign/{userRole}/{userIdentifier}/{YYYY-MM-DD}/{timestamp}-{fileName}
    const cleanIdentifier = userIdentifier ? userIdentifier.replace(/[^\w-]/g, '') : 'anonymous';
    // Use local date (not UTC) so the folder date matches the actual upload date in IST
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cleanFileName = fileName.replace(/\s+/g, '_'); // Replace spaces with underscores for clean S3 keys
    const customObjectKey = `ugc-campaign/${userRole}/${cleanIdentifier}/${dateStr}/${Date.now()}-${cleanFileName}`;

    // 5. Generate URL
    const uploadData = await s3.generatePresignedUploadUrl(fileName, fileType, customObjectKey);

    return res.status(200).json({
      success: true,
      data: uploadData
    });
  } catch (error) {
    console.error('[Upload Controller] Error generating pre-signed URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate pre-signed upload credentials.',
      error: error.message
    });
  }
}

/**
 * Handle a simulated PUT request for mock S3 uploads.
 * PUT /api/upload/mock-s3-put
 */
function handleMockS3Put(req, res) {
  const { key } = req.query;
  console.log(`[Mock S3] Received simulated upload PUT for object key: ${key}`);
  
  // Just simulate successful upload
  return res.status(200).send('Successfully uploaded to Mock S3');
}

module.exports = {
  getPresignedUrl,
  handleMockS3Put
};
