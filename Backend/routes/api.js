const express = require('express');
const router = express.Router();

const uploadController = require('../controllers/uploadController');
const submissionController = require('../controllers/submissionController');
const metadataController = require('../controllers/metadataController');

// 1. S3 Pre-signed URL Routing
router.post('/upload/presigned-url', uploadController.getPresignedUrl);
router.put('/upload/mock-s3-put', uploadController.handleMockS3Put); // For local simulator PUT uploads

// 2. Submission Management Routing
router.post('/submissions', submissionController.createSubmission);
router.get('/submissions', submissionController.getSubmissions);
router.get('/submissions/stats', submissionController.getStats);
router.put('/submissions/:id/moderate', submissionController.moderateSubmission);
router.put('/submissions/:id/winner', submissionController.selectWinner);

// 3. Campaign Metadata Routing
router.get('/metadata/locations', metadataController.getLocations);
router.get('/metadata/operators', metadataController.getOperators);
router.get('/metadata/devices', metadataController.getDevices);

module.exports = router;
