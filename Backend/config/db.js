const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const isDbConfigured = !!MONGODB_URI;

let client = null;
let dbInstance = null;
let submissionsCollection = null;
let surveyResponsesCollection = null;

let mockDb = [];
let mockSurveyDb = [];

if (isDbConfigured) {
  console.log('[Database] Connecting to MongoDB Atlas...');
  client = new MongoClient(MONGODB_URI);
  client.connect().then(() => {
    dbInstance = client.db();
    submissionsCollection = dbInstance.collection('submissions_migrated');
    surveyResponsesCollection = dbInstance.collection('survey_responses');
    console.log('[Database] MongoDB Atlas connection pool established.');
  }).catch(err => {
    console.error('[Database] MongoDB connection failed:', err.message);
  });
} else {
  console.warn('[Database] MONGODB_URI environment variable missing. Running in MEMORY MOCK MODE.');
}

/**
 * Insert a new submission.
 */
async function insertSubmission(data) {
  const cleanData = {
    user_identifier: data.userIdentifier,
    user_role: data.userRole,
    media_url: data.mediaUrl,
    thumbnail_url: data.thumbnailUrl || data.mediaUrl,
    file_name: data.fileName,
    file_size: parseInt(data.fileSize, 10),
    location: data.location,
    travel_date: data.travelDate,
    full_name: data.fullName || null,
    tour_manager: data.tourManager || null,
    device: data.device || null,
    insta_handle: data.instaHandle || null,
    status: 'pending',
    is_winner: false,
    winner_selected_at: null,
    score_composition: null,
    score_watermark: null,
    score_location: null,
    score_engagement: null,
    score_consistency: null,
    score_total: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  if (submissionsCollection) {
    // Generate numeric id to maintain simple sequential compatibility
    const lastDoc = await submissionsCollection.findOne({}, { sort: { id: -1 } });
    cleanData.id = lastDoc ? lastDoc.id + 1 : 1;
    
    await submissionsCollection.insertOne(cleanData);
    return cleanData;
  } else {
    cleanData.id = mockDb.length + 1;
    mockDb.push(cleanData);
    return cleanData;
  }
}

/**
 * Fetch filtered list of submissions.
 */
async function getSubmissions(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.role) query.user_role = filters.role;
  if (filters.isWinner !== undefined) {
    query.is_winner = filters.isWinner === 'true' || filters.isWinner === true;
  }
  // Exclude soft-deleted submissions unless explicitly requested
  if (filters.includeDeleted !== 'true') {
    query.is_deleted = { $ne: true };
  }

  if (submissionsCollection) {
    return await submissionsCollection.find(query).sort({ id: -1 }).toArray();
  } else {
    let list = [...mockDb];
    if (filters.includeDeleted !== 'true') {
      list = list.filter(r => !r.is_deleted);
    }
    if (filters.status) list = list.filter(r => r.status === filters.status);
    if (filters.role) list = list.filter(r => r.user_role === filters.role);
    if (filters.isWinner !== undefined) {
      const isWinVal = filters.isWinner === 'true' || filters.isWinner === true;
      list = list.filter(r => r.is_winner === isWinVal);
    }
    list.sort((a, b) => b.id - a.id);
    return list;
  }
}

/**
 * Update single submission fields by ID.
 */
async function updateSubmission(id, updateFields) {
  const numericId = parseInt(id, 10);
  const cleanFields = { ...updateFields, updated_at: new Date() };

  if (submissionsCollection) {
    const result = await submissionsCollection.findOneAndUpdate(
      { id: numericId },
      { $set: cleanFields },
      { returnDocument: 'after' }
    );
    return result ? (result.value || result) : null;
  } else {
    const record = mockDb.find(r => r.id === numericId);
    if (record) {
      Object.assign(record, cleanFields);
      return record;
    }
    return null;
  }
}

/**
 * Update multiple submissions by their numeric IDs.
 */
async function bulkUpdateSubmissions(ids, updateFields) {
  const numericIds = ids.map(id => parseInt(id, 10));
  const cleanFields = { ...updateFields, updated_at: new Date() };

  if (submissionsCollection) {
    const result = await submissionsCollection.updateMany(
      { id: { $in: numericIds } },
      { $set: cleanFields }
    );
    return { modifiedCount: result.modifiedCount };
  } else {
    let modifiedCount = 0;
    mockDb.forEach(record => {
      if (numericIds.includes(record.id)) {
        Object.assign(record, cleanFields);
        modifiedCount++;
      }
    });
    return { modifiedCount };
  }
}

/**
 * Bulk soft-delete submissions (Keeps data in Mongo and files in S3, marks is_deleted: true).
 */
async function bulkDeleteSubmissions(ids) {
  const numericIds = ids.map(id => parseInt(id, 10));
  const updateFields = { is_deleted: true, deleted_at: new Date(), updated_at: new Date() };

  if (submissionsCollection) {
    const result = await submissionsCollection.updateMany(
      { id: { $in: numericIds } },
      { $set: updateFields }
    );
    return { modifiedCount: result.modifiedCount };
  } else {
    let modifiedCount = 0;
    mockDb.forEach(record => {
      if (numericIds.includes(record.id)) {
        Object.assign(record, updateFields);
        modifiedCount++;
      }
    });
    return { modifiedCount };
  }
}

/**
 * Soft-delete single submission by ID.
 */
async function deleteSubmission(id) {
  return await updateSubmission(id, { is_deleted: true, deleted_at: new Date() });
}

/**
 * Fetch database summary stats/KPI values.
 */
async function getStats() {
  const baseQuery = { is_deleted: { $ne: true } };

  if (submissionsCollection) {
    const total = await submissionsCollection.countDocuments(baseQuery);
    const approved = await submissionsCollection.countDocuments({ ...baseQuery, status: 'approved' });
    const pending = await submissionsCollection.countDocuments({ ...baseQuery, status: 'pending' });
    const locationsList = await submissionsCollection.distinct('location', baseQuery);
    const locations = locationsList ? locationsList.length : 0;
    return { total, approved, pending, uniqueLocations: locations };
  } else {
    const active = mockDb.filter(r => !r.is_deleted);
    const total = active.length;
    const approved = active.filter(r => r.status === 'approved').length;
    const pending = active.filter(r => r.status === 'pending').length;
    const uniqueLocations = [...new Set(active.map(r => r.location))].length;
    return { total, approved, pending, uniqueLocations };
  }
}

/**
 * Insert a new survey response.
 */
async function insertSurveyResponse(data) {
  const cleanData = {
    name: data.name || '',
    location: data.location || '',
    email: data.email || '',
    phone: data.phone || '',
    q1: data.q1 || null,
    q2: data.q2 || null,
    q3: data.q3 || null,
    q4: data.q4 || null,
    q5: data.q5 || null,
    q6: data.q6 || null,
    q7: Array.isArray(data.q7) ? data.q7 : (data.q7 ? [data.q7] : []),
    q8: data.q8 || '',
    created_at: new Date()
  };

  if (surveyResponsesCollection) {
    await surveyResponsesCollection.insertOne(cleanData);
    return cleanData;
  } else {
    mockSurveyDb.push(cleanData);
    return cleanData;
  }
}

/**
 * Fetch all survey responses.
 */
async function getSurveyResponses() {
  if (surveyResponsesCollection) {
    return await surveyResponsesCollection.find({}).sort({ created_at: -1 }).toArray();
  } else {
    return [...mockSurveyDb].sort((a, b) => b.created_at - a.created_at);
  }
}

module.exports = {
  client,
  isDbConfigured: () => isDbConfigured,
  insertSubmission,
  getSubmissions,
  updateSubmission,
  bulkUpdateSubmissions,
  bulkDeleteSubmissions,
  deleteSubmission,
  getStats,
  insertSurveyResponse,
  getSurveyResponses,
  getMockDb: () => mockDb,
  setMockDb: (data) => { mockDb = data; },
  getMockSurveyDb: () => mockSurveyDb
};
