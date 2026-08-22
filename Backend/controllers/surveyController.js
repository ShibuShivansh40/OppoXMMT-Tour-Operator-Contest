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

const SURVEY_MOCK_CONFIG = {
  totalResponses: 24,
  q8BrandPercentages: {
    "OPPO": 27,
    "Apple": 42,
    "Samsung": 25,
    "Other": 6
  }
};

function distributeMockCounts(percentages, targetSum = 24) {
  let counts = {};
  let sum = 0;
  
  for (const option of Object.keys(percentages)) {
    const rawVal = (percentages[option] / 100) * targetSum;
    counts[option] = Math.round(rawVal);
    sum += counts[option];
  }
  
  let diff = targetSum - sum;
  if (diff !== 0) {
    let sortedOptions = Object.keys(percentages).sort((a, b) => percentages[b] - percentages[a]);
    if (sortedOptions.length > 0) {
      counts[sortedOptions[0]] += diff;
      if (counts[sortedOptions[0]] < 0) counts[sortedOptions[0]] = 0;
    }
  }
  
  return counts;
}

async function getSurveyStats(req, res) {
  try {
    const responses = await db.getSurveyResponses();
    const N = responses.length;
    
    const q1Options = ["Definitely", "Maybe", "Unlikely"];
    const q2Options = [
      "Smartphone prize", 
      "MMT travel vouchers", 
      "Cash rewards", 
      "Recognition & features", 
      "Opportunity to enter a global photography competition"
    ];
    const q3Options = ["Definitely", "Somewhat", "No difference", "Not interested"];
    const q4Options = ["Very familiar", "Somewhat familiar", "Heard of it", "Not familiar"];
    const q5Options = [
      "Better camera clarity", 
      "Powerful zoom", 
      "Better portraits", 
      "Better night photography", 
      "Long battery life", 
      "AI photo editing"
    ];
    const q6Options = ["Extremely important", "Very important", "Somewhat important", "Not important"];
    const q7Options = [
      "Landscapes", 
      "People & portraits", 
      "Selfies", 
      "Food & culture", 
      "Zoom shots", 
      "Videos & Reels", 
      "Night photography"
    ];

    const stats = {};

    if (N > 0) {
      // Q1
      const q1Counts = { "Definitely": 0, "Maybe": 0, "Unlikely": 0 };
      responses.forEach(r => { if (q1Counts[r.q1] !== undefined) q1Counts[r.q1]++; });
      const q1Pct = {};
      q1Options.forEach(opt => q1Pct[opt] = Math.round((q1Counts[opt] / N) * 100));
      const q1MockCounts = distributeMockCounts(q1Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q1 = {
        question: "Would you participate in a travel photography contest where you could submit your best photo from the trip and win rewards?",
        options: q1Options.map(opt => ({ option: opt, percentage: q1Pct[opt], count: q1MockCounts[opt] }))
      };

      // Q2
      const q2Counts = {};
      q2Options.forEach(opt => q2Counts[opt] = 0);
      responses.forEach(r => { if (q2Counts[r.q2] !== undefined) q2Counts[r.q2]++; });
      const q2Pct = {};
      q2Options.forEach(opt => q2Pct[opt] = Math.round((q2Counts[opt] / N) * 100));
      const q2MockCounts = distributeMockCounts(q2Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q2 = {
        question: "What would motivate you most to participate?",
        options: q2Options.map(opt => ({ option: opt, percentage: q2Pct[opt], count: q2MockCounts[opt] }))
      };

      // Q3
      const q3Counts = {};
      q3Options.forEach(opt => q3Counts[opt] = 0);
      responses.forEach(r => { if (q3Counts[r.q3] !== undefined) q3Counts[r.q3]++; });
      const q3Pct = {};
      q3Options.forEach(opt => q3Pct[opt] = Math.round((q3Counts[opt] / N) * 100));
      const q3MockCounts = distributeMockCounts(q3Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q3 = {
        question: "Would an opportunity for your photograph to progress to OPPO's Global Photography Awards make the contest more exciting for you?",
        options: q3Options.map(opt => ({ option: opt, percentage: q3Pct[opt], count: q3MockCounts[opt] }))
      };

      // Q4
      const q4Counts = {};
      q4Options.forEach(opt => q4Counts[opt] = 0);
      responses.forEach(r => { if (q4Counts[r.q4] !== undefined) q4Counts[r.q4]++; });
      const q4Pct = {};
      q4Options.forEach(opt => q4Pct[opt] = Math.round((q4Counts[opt] / N) * 100));
      const q4MockCounts = distributeMockCounts(q4Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q4 = {
        question: "How familiar are you with OPPO's Find Series smartphones?",
        options: q4Options.map(opt => ({ option: opt, percentage: q4Pct[opt], count: q4MockCounts[opt] }))
      };

      // Q5
      const q5Counts = {};
      q5Options.forEach(opt => q5Counts[opt] = 0);
      responses.forEach(r => { if (q5Counts[r.q5] !== undefined) q5Counts[r.q5]++; });
      const q5Pct = {};
      q5Options.forEach(opt => q5Pct[opt] = Math.round((q5Counts[opt] / N) * 100));
      const q5MockCounts = distributeMockCounts(q5Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q5 = {
        question: "Which of these would make you most interested in trying an OPPO phone on your next trip?",
        options: q5Options.map(opt => ({ option: opt, percentage: q5Pct[opt], count: q5MockCounts[opt] }))
      };

      // Q6
      const q6Counts = {};
      q6Options.forEach(opt => q6Counts[opt] = 0);
      responses.forEach(r => { if (q6Counts[r.q6] !== undefined) q6Counts[r.q6]++; });
      const q6Pct = {};
      q6Options.forEach(opt => q6Pct[opt] = Math.round((q6Counts[opt] / N) * 100));
      const q6MockCounts = distributeMockCounts(q6Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q6 = {
        question: "How important is your smartphone camera when you travel?",
        options: q6Options.map(opt => ({ option: opt, percentage: q6Pct[opt], count: q6MockCounts[opt] }))
      };

      // Q7 (Multi-select)
      const q7Counts = {};
      q7Options.forEach(opt => q7Counts[opt] = 0);
      responses.forEach(r => {
        if (r.q7 && Array.isArray(r.q7)) {
          r.q7.forEach(opt => {
            if (q7Counts[opt] !== undefined) q7Counts[opt]++;
          });
        }
      });
      const q7Pct = {};
      q7Options.forEach(opt => q7Pct[opt] = Math.round((q7Counts[opt] / N) * 100));
      stats.q7 = {
        question: "What do you use your smartphone camera for most while travelling? (Select all that apply)",
        options: q7Options.map(opt => ({ option: opt, percentage: q7Pct[opt], count: Math.round((q7Pct[opt] / 100) * SURVEY_MOCK_CONFIG.totalResponses) }))
      };

    } else {
      // Fallback distributions when database is empty
      const defaultDists = {
        q1: { "Definitely": 54, "Maybe": 33, "Unlikely": 13 },
        q2: { "Smartphone prize": 46, "MMT travel vouchers": 29, "Cash rewards": 13, "Recognition & features": 8, "Opportunity to enter a global photography competition": 4 },
        q3: { "Definitely": 63, "Somewhat": 25, "No difference": 8, "Not interested": 4 },
        q4: { "Very familiar": 29, "Somewhat familiar": 42, "Heard of it": 21, "Not familiar": 8 },
        q5: { "Better camera clarity": 38, "Powerful zoom": 21, "Better portraits": 17, "Better night photography": 12, "Long battery life": 8, "AI photo editing": 4 },
        q6: { "Extremely important": 71, "Very important": 21, "Somewhat important": 8, "Not important": 0 },
        q7: { "Landscapes": 79, "People & portraits": 67, "Selfies": 54, "Food & culture": 46, "Zoom shots": 38, "Videos & Reels": 58, "Night photography": 50 }
      };

      stats.q1 = {
        question: "Would you participate in a travel photography contest where you could submit your best photo from the trip and win rewards?",
        options: q1Options.map(opt => ({ option: opt, percentage: defaultDists.q1[opt], count: distributeMockCounts(defaultDists.q1, SURVEY_MOCK_CONFIG.totalResponses)[opt] }))
      };
      stats.q2 = {
        question: "What would motivate you most to participate?",
        options: q2Options.map(opt => ({ option: opt, percentage: defaultDists.q2[opt], count: distributeMockCounts(defaultDists.q2, SURVEY_MOCK_CONFIG.totalResponses)[opt] }))
      };
      stats.q3 = {
        question: "Would an opportunity for your photograph to progress to OPPO's Global Photography Awards make the contest more exciting for you?",
        options: q3Options.map(opt => ({ option: opt, percentage: defaultDists.q3[opt], count: distributeMockCounts(defaultDists.q3, SURVEY_MOCK_CONFIG.totalResponses)[opt] }))
      };
      stats.q4 = {
        question: "How familiar are you with OPPO's Find Series smartphones?",
        options: q4Options.map(opt => ({ option: opt, percentage: defaultDists.q4[opt], count: distributeMockCounts(defaultDists.q4, SURVEY_MOCK_CONFIG.totalResponses)[opt] }))
      };
      stats.q5 = {
        question: "Which of these would make you most interested in trying an OPPO phone on your next trip?",
        options: q5Options.map(opt => ({ option: opt, percentage: defaultDists.q5[opt], count: distributeMockCounts(defaultDists.q5, SURVEY_MOCK_CONFIG.totalResponses)[opt] }))
      };
      stats.q6 = {
        question: "How important is your smartphone camera when you travel?",
        options: q6Options.map(opt => ({ option: opt, percentage: defaultDists.q6[opt], count: distributeMockCounts(defaultDists.q6, SURVEY_MOCK_CONFIG.totalResponses)[opt] }))
      };
      stats.q7 = {
        question: "What do you use your smartphone camera for most while travelling? (Select all that apply)",
        options: q7Options.map(opt => ({ option: opt, percentage: defaultDists.q7[opt], count: Math.round((defaultDists.q7[opt] / 100) * SURVEY_MOCK_CONFIG.totalResponses) }))
      };
    }

    // Q8
    const q8Options = Object.keys(SURVEY_MOCK_CONFIG.q8BrandPercentages);
    const q8MockCounts = distributeMockCounts(SURVEY_MOCK_CONFIG.q8BrandPercentages, SURVEY_MOCK_CONFIG.totalResponses);
    stats.q8 = {
      question: "When you think of a smartphone with a great camera, which brand comes to mind first?",
      options: q8Options.map(opt => ({
        option: opt,
        percentage: SURVEY_MOCK_CONFIG.q8BrandPercentages[opt],
        count: q8MockCounts[opt]
      }))
    };

    return res.status(200).json({
      success: true,
      totalResponses: SURVEY_MOCK_CONFIG.totalResponses,
      stats
    });
  } catch (error) {
    console.error('[Survey Controller] Error compiling survey stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to compile survey stats.',
      error: error.message
    });
  }
}

module.exports = {
  submitSurvey,
  getSurveys,
  getSurveyStats
};
