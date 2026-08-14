const db = require('../config/db');

/**
 * Handle new survey submissions.
 * POST /api/survey
 */
async function submitSurvey(req, res) {
  try {
    const { q1, q2, q3, q4, q5, q6, q7, q8, name, location, email, phone } = req.body;

    // Validation checks
    if (!q1 || !q2 || !q3 || !q4 || !q5 || !q6 || !q8 || !name || !location || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All questions and contact fields are required. Please answer all fields.'
      });
    }

    if (!q7 || !Array.isArray(q7) || q7.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one use case for question 7.'
      });
    }

    // Insert into database
    const savedResponse = await db.insertSurveyResponse({
      q1, q2, q3, q4, q5, q6, q7, q8, name, location, email, phone
    });

    return res.status(201).json({
      success: true,
      message: 'Survey response successfully recorded. Thank you for your feedback!',
      data: savedResponse
    });
  } catch (error) {
    console.error('[Survey Controller] Error submitting survey:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit survey. Please try again.',
      error: error.message
    });
  }
}

/**
 * Retrieve all survey responses.
 * GET /api/survey
 */
async function getSurveys(req, res) {
  try {
    const responses = await db.getSurveyResponses();
    return res.status(200).json({
      success: true,
      count: responses.length,
      data: responses
    });
  } catch (error) {
    console.error('[Survey Controller] Error fetching survey responses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve survey responses.',
      error: error.message
    });
  }
}

module.exports = {
  submitSurvey,
  getSurveys
};
