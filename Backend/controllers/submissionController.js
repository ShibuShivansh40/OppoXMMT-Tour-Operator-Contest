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

    // 2. Insert into Database
    const queryText = `
      INSERT INTO submissions (user_identifier, user_role, media_url, file_name, file_size, location, travel_date, full_name, tour_manager, device, insta_handle)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const params = [
      userIdentifier, 
      userRole, 
      mediaUrl, 
      fileName, 
      parseInt(fileSize), 
      location, 
      travelDate,
      fullName || null,
      tourManager || null,
      device || null,
      instaHandle || null
    ];
    const result = await db.query(queryText, params);
    const signedUrl = await s3.getSignedDownloadUrl(result.rows[0].media_url);

    return res.status(201).json({
      success: true,
      message: 'Submission successfully recorded.',
      data: {
        ...result.rows[0],
        media_url: signedUrl
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
 * Retrieve submissions with optional filters (status, role, is_winner).
 * GET /api/submissions
 */
async function getSubmissions(req, res) {
  try {
    const { status, role, isWinner } = req.query;

    let queryText = 'SELECT * FROM submissions';
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (role) {
      params.push(role);
      conditions.push(`user_role = $${params.length}`);
    }

    if (isWinner !== undefined) {
      const boolVal = isWinner === 'true';
      params.push(boolVal);
      conditions.push(`is_winner = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY id DESC';

    const result = await db.query(queryText, params);
    const signedRows = await Promise.all(result.rows.map(async (row) => {
      const signedUrl = await s3.getSignedDownloadUrl(row.media_url);
      return { ...row, media_url: signedUrl };
    }));

    return res.status(200).json({
      success: true,
      count: result.rowCount,
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

    const queryText = `
      UPDATE submissions
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(queryText, [status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission record not found.'
      });
    }

    const signedUrl = await s3.getSignedDownloadUrl(result.rows[0].media_url);

    return res.status(200).json({
      success: true,
      message: `Submission successfully marked as ${status}.`,
      data: {
        ...result.rows[0],
        media_url: signedUrl
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
    const winnerTime = val ? 'CURRENT_TIMESTAMP' : 'NULL';

    const queryText = `
      UPDATE submissions
      SET is_winner = $1, winner_selected_at = ${winnerTime}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(queryText, [val, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission record not found.'
      });
    }

    const signedUrl = await s3.getSignedDownloadUrl(result.rows[0].media_url);

    return res.status(200).json({
      success: true,
      message: val ? 'Winner successfully selected!' : 'Winner status revoked.',
      data: {
        ...result.rows[0],
        media_url: signedUrl
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
    const totalQuery = 'SELECT COUNT(*)::int as total FROM submissions';
    const approvedQuery = "SELECT COUNT(*)::int as approved FROM submissions WHERE status = 'approved'";
    const pendingQuery = "SELECT COUNT(*)::int as pending FROM submissions WHERE status = 'pending'";
    const uniqueLocationsQuery = 'SELECT COUNT(DISTINCT location)::int as locations FROM submissions';

    // We can run query aggregation depending on mode
    // The query utility automatically handles aggregation queries in mockDb fallback
    const statsResult = await db.query('SELECT stats FROM submissions LIMIT 1'); // trigger mock or DB handler query

    if (statsResult.rows && statsResult.rows[0] && statsResult.rows[0].total_submissions !== undefined) {
      // Mock db response
      const stats = statsResult.rows[0];
      return res.status(200).json({
        success: true,
        data: {
          total: stats.total_submissions,
          approved: stats.approved_submissions,
          pending: stats.pending_submissions,
          uniqueLocations: stats.unique_locations
        }
      });
    }

    // Real PostgreSQL queries
    const [totRes, appRes, penRes, locRes] = await Promise.all([
      db.query(totalQuery),
      db.query(approvedQuery),
      db.query(pendingQuery),
      db.query(uniqueLocationsQuery)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total: totRes.rows[0].total,
        approved: appRes.rows[0].approved,
        pending: penRes.rows[0].pending,
        uniqueLocations: locRes.rows[0].locations
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

    const queryText = `
      UPDATE submissions
      SET score_composition = $1, 
          score_watermark = $2, 
          score_location = $3, 
          score_engagement = $4, 
          score_consistency = $5, 
          score_total = $6, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    const params = [comp, wat, loc, eng, con, total, id];
    const result = await db.query(queryText, params);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission record not found.'
      });
    }

    const signedUrl = await s3.getSignedDownloadUrl(result.rows[0].media_url);

    return res.status(200).json({
      success: true,
      message: 'Scores successfully saved!',
      data: {
        ...result.rows[0],
        media_url: signedUrl
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

module.exports = {
  createSubmission,
  getSubmissions,
  moderateSubmission,
  selectWinner,
  getStats,
  saveSubmissionScore
};

