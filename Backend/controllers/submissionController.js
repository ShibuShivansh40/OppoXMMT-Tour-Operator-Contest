const db = require('../config/db');
const s3 = require('../config/s3');

/**
 * Log a new submission metadata after file upload.
 * POST /api/submissions
 */
async function createSubmission(req, res) {
  try {
    const { 
      userIdentifier, 
      userRole, 
      mediaUrl, 
      thumbnailUrl,
      fileName, 
      fileSize, 
      location, 
      travelDate,
      fullName,
      tourManager,
      device,
      instaHandle
    } = req.body;

    // 1. Validation
    if (!userIdentifier || !userRole || !mediaUrl || !fileName || !fileSize || !location || !travelDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing submission details. All fields are required.'
      });
    }

    if (userRole !== 'traveler' && userRole !== 'operator') {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'traveler' or 'operator'."
      });
    }

    // Basic formats
    if (userRole === 'traveler' && !/^\+?\d{10,15}$/.test(userIdentifier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid traveler contact number. Must be a valid phone number.'
      });
    }

    // 2. Insert into Database using MongoDB helper
    const cleanRecord = await db.insertSubmission({
      userIdentifier, 
      userRole, 
      mediaUrl, 
      thumbnailUrl,
      fileName, 
      fileSize, 
      location, 
      travelDate,
      fullName,
      tourManager,
      device,
      instaHandle
    });

    const signedUrl = await s3.getSignedDownloadUrl(cleanRecord.media_url);
    const signedThumbUrl = await s3.getSignedDownloadUrl(cleanRecord.thumbnail_url || cleanRecord.media_url);

    return res.status(201).json({
      success: true,
      message: 'Submission successfully recorded.',
      data: {
        ...cleanRecord,
        media_url: signedUrl,
        thumbnail_url: signedThumbUrl
      }
    });
  } catch (error) {
    console.error('[Submission Controller] Error creating submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Database logging failed.',
      error: error.message
    });
  }
}

/**
 * Retrieve submissions with optional filters (status, role, isWinner).
 * GET /api/submissions
 */
async function getSubmissions(req, res) {
  try {
    const { status, role, isWinner } = req.query;
    const records = await db.getSubmissions({ status, role, isWinner });

    const signedRows = await Promise.all(records.map(async (row) => {
      const signedUrl = await s3.getSignedDownloadUrl(row.media_url);
      const signedThumbUrl = await s3.getSignedDownloadUrl(row.thumbnail_url || row.media_url);
      return { ...row, media_url: signedUrl, thumbnail_url: signedThumbUrl };
    }));

    return res.status(200).json({
      success: true,
      count: signedRows.length,
      data: signedRows
    });
  } catch (error) {
    console.error('[Submission Controller] Error fetching submissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve submissions.',
      error: error.message
    });
  }
}

/**
 * Moderate submission (Approve / Reject).
 * PUT /api/submissions/:id/moderate
 */
async function moderateSubmission(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return res.status(400).json({
        success: false,
        message: "Status parameter must be 'approved' or 'rejected'."
      });
    }

    const updatedRecord = await db.updateSubmission(id, { status });

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Submission record not found.'
      });
    }

    const signedUrl = await s3.getSignedDownloadUrl(updatedRecord.media_url);
    const signedThumbUrl = await s3.getSignedDownloadUrl(updatedRecord.thumbnail_url || updatedRecord.media_url);

    return res.status(200).json({
      success: true,
      message: `Submission successfully marked as ${status}.`,
      data: {
        ...updatedRecord,
        media_url: signedUrl,
        thumbnail_url: signedThumbUrl
      }
    });
  } catch (error) {
    console.error('[Submission Controller] Error moderating submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Database update failed.',
      error: error.message
    });
  }
}

/**
 * Select campaign winner.
 * PUT /api/submissions/:id/winner
 */
async function selectWinner(req, res) {
  try {
    const { id } = req.params;
    const { isWinner } = req.body; // boolean

    if (isWinner === undefined) {
      return res.status(400).json({
        success: false,
        message: "Body must contain boolean parameter 'isWinner'."
      });
    }

    const val = !!isWinner;
    const updatedRecord = await db.updateSubmission(id, {
      is_winner: val,
      winner_selected_at: val ? new Date() : null
    });

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Submission record not found.'
      });
    }

    const signedUrl = await s3.getSignedDownloadUrl(updatedRecord.media_url);
    const signedThumbUrl = await s3.getSignedDownloadUrl(updatedRecord.thumbnail_url || updatedRecord.media_url);

    return res.status(200).json({
      success: true,
      message: val ? 'Winner successfully selected!' : 'Winner status revoked.',
      data: {
        ...updatedRecord,
        media_url: signedUrl,
        thumbnail_url: signedThumbUrl
      }
    });
  } catch (error) {
    console.error('[Submission Controller] Error selecting winner:', error);
    return res.status(500).json({
      success: false,
      message: 'Database update failed.',
      error: error.message
    });
  }
}

/**
 * Retrieve Campaign statistics/KPIs for MMT Dashboard.
 * GET /api/submissions/stats
 */
async function getStats(req, res) {
  try {
    const stats = await db.getStats();

    return res.status(200).json({
      success: true,
      data: {
        total: stats.total,
        approved: stats.approved,
        pending: stats.pending,
        uniqueLocations: stats.uniqueLocations
      }
    });
  } catch (error) {
    console.error('[Submission Controller] Error generating dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats.',
      error: error.message
    });
  }
}

/**
 * Save evaluation scores for a submission.
 * PUT /api/submissions/:id/score
 */
async function saveSubmissionScore(req, res) {
  try {
    const { id } = req.params;
    const { scoreComposition, scoreWatermark, scoreLocation, scoreEngagement, scoreConsistency } = req.body;

    if (
      scoreComposition === undefined ||
      scoreWatermark === undefined ||
      scoreLocation === undefined ||
      scoreEngagement === undefined ||
      scoreConsistency === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'All scoring fields are required.'
      });
    }

    const comp = parseInt(scoreComposition);
    const wat = parseInt(scoreWatermark);
    const loc = parseInt(scoreLocation);
    const eng = parseInt(scoreEngagement);
    const con = parseInt(scoreConsistency);

    // Rubric limit validation
    if (
      comp < 0 || comp > 25 ||
      wat < 0 || wat > 20 ||
      loc < 0 || loc > 25 ||
      eng < 0 || eng > 20 ||
      con < 0 || con > 10
    ) {
      return res.status(400).json({
        success: false,
        message: 'One or more scores exceed their rubric limits.'
      });
    }

    const total = comp + wat + loc + eng + con;

    const updatedRecord = await db.updateSubmission(id, {
      score_composition: comp,
      score_watermark: wat,
      score_location: loc,
      score_engagement: eng,
      score_consistency: con,
      score_total: total
    });

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Submission record not found.'
      });
    }

    const signedUrl = await s3.getSignedDownloadUrl(updatedRecord.media_url);
    const signedThumbUrl = await s3.getSignedDownloadUrl(updatedRecord.thumbnail_url || updatedRecord.media_url);

    return res.status(200).json({
      success: true,
      message: 'Scores successfully saved!',
      data: {
        ...updatedRecord,
        media_url: signedUrl,
        thumbnail_url: signedThumbUrl
      }
    });
  } catch (error) {
    console.error('[Submission Controller] Error saving score:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save scores.',
      error: error.message
    });
  }
}

/**
 * Bulk moderate submissions (Approve / Reject multiple).
 * PUT /api/submissions/bulk-moderate
 */
async function bulkModerateSubmissions(req, res) {
  try {
    const { ids, status } = req.body; // ids is an array of numeric IDs, status is 'approved' or 'rejected'

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return res.status(400).json({
        success: false,
        message: "Status parameter must be 'approved' or 'rejected'."
      });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain a non-empty array 'ids'."
      });
    }

    const result = await db.bulkUpdateSubmissions(ids, { status });

    return res.status(200).json({
      success: true,
      message: `Successfully marked ${result.modifiedCount} submissions as ${status}.`,
      data: result
    });
  } catch (error) {
    console.error('[Submission Controller] Error bulk moderating submissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Database bulk update failed.',
      error: error.message
    });
  }
}

module.exports = {
  createSubmission,
  getSubmissions,
  moderateSubmission,
  bulkModerateSubmissions,
  selectWinner,
  getStats,
  saveSubmissionScore
};
