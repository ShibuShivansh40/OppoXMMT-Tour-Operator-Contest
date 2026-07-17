const express = require('express');
const router = express.Router();

const uploadController = require('../controllers/uploadController');
const submissionController = require('../controllers/submissionController');
const metadataController = require('../controllers/metadataController');
const { apiAuthMiddleware, handleLogin, handleLogout } = require('../middleware/auth');

// 0. Authentication Routing
router.post('/auth/login', handleLogin);
router.post('/auth/logout', handleLogout);

// 1. S3 Pre-signed URL Routing
router.post('/upload/presigned-url', uploadController.getPresignedUrl);
router.put('/upload/mock-s3-put', uploadController.handleMockS3Put); // For local simulator PUT uploads

// 2. Submission Management Routing
router.post('/submissions', submissionController.createSubmission);
router.get('/submissions', apiAuthMiddleware(['mmt', 'oppo']), submissionController.getSubmissions);
router.get('/submissions/stats', apiAuthMiddleware(['mmt', 'oppo']), submissionController.getStats);
router.put('/submissions/bulk-moderate', apiAuthMiddleware('mmt'), submissionController.bulkModerateSubmissions);
router.put('/submissions/:id/moderate', apiAuthMiddleware('mmt'), submissionController.moderateSubmission);
router.put('/submissions/:id/winner', apiAuthMiddleware('oppo'), submissionController.selectWinner);
router.put('/submissions/:id/score', apiAuthMiddleware('oppo'), submissionController.saveSubmissionScore);

// 3. Campaign Metadata Routing
router.get('/metadata/locations', metadataController.getLocations);
router.get('/metadata/operators', metadataController.getOperators);
router.get('/metadata/devices', metadataController.getDevices);

module.exports = router;

