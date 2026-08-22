const path = require('path');
require('dotenv').config();

const db = require('./config/db');

async function test() {
  try {
    console.log('[Test] Connecting to DB...');
    // Connect to database if needed (db.connectDb is called on app boot)
    // Let's check connection state
    console.log('[Test] DB Connection status...');

    // Connect to Mongo
    const { MongoClient } = require('mongodb');
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in environment!');
    }
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('[Test] Connected to Mongo!');

    const dbInstance = client.db(process.env.MONGODB_DB_NAME || 'oppo_mmt_contest');
    const surveyResponsesCollection = dbInstance.collection('survey_responses');
    const responses = await surveyResponsesCollection.find({}).toArray();
    console.log('[Test] Found responses in DB:', responses.length);
    if (responses.length > 0) {
      console.log('[Test] Sample response:', JSON.stringify(responses[0]));
    }

    // Now run our stats logic
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

    const N = responses.length;
    const q1Options = ["Definitely", "Maybe", "Unlikely"];
    const q2Options = ["Smartphone prize", "MMT travel vouchers", "Cash rewards", "Recognition & features", "Opportunity to enter a global photography competition"];
    const q3Options = ["Definitely", "Somewhat", "No difference", "Not interested"];
    const q4Options = ["Very familiar", "Somewhat familiar", "Heard of it", "Not familiar"];
    const q5Options = ["Better camera clarity", "Powerful zoom", "Better portraits", "Better night photography", "Long battery life", "AI photo editing"];
    const q6Options = ["Extremely important", "Very important", "Somewhat important", "Not important"];
    const q7Options = ["Landscapes", "People & portraits", "Selfies", "Food & culture", "Zoom shots", "Videos & Reels", "Night photography"];

    const stats = {};
    if (N > 0) {
      // Q1
      const q1Counts = { "Definitely": 0, "Maybe": 0, "Unlikely": 0 };
      responses.forEach(r => { if (q1Counts[r.q1] !== undefined) q1Counts[r.q1]++; });
      const q1Pct = {};
      q1Options.forEach(opt => q1Pct[opt] = Math.round((q1Counts[opt] / N) * 100));
      const q1MockCounts = distributeMockCounts(q1Pct, SURVEY_MOCK_CONFIG.totalResponses);
      stats.q1 = {
        question: "Would you participate in a travel photography contest?",
        options: q1Options.map(opt => ({ option: opt, percentage: q1Pct[opt], count: q1MockCounts[opt] }))
      };
      console.log('[Test] Q1 Stats computed successfully:', stats.q1);
    }

    console.log('[Test] Finished testing calculation logic!');
    await client.close();
  } catch (err) {
    console.error('[Test Error]', err);
  }
}

test();
