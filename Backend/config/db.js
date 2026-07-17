const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const isDbConfigured = !!MONGODB_URI;

let client = null;
let dbInstance = null;
let submissionsCollection = null;

let mockDb = [];

if (isDbConfigured) {
  console.log('[Database] Connecting to MongoDB Atlas...');
  client = new MongoClient(MONGODB_URI);
  client.connect().then(() => {
    dbInstance = client.db();
    submissionsCollection = dbInstance.collection('submissions_migrated');
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

  if (submissionsCollection) {
    return await submissionsCollection.find(query).sort({ id: -1 }).toArray();
  } else {
    let list = [...mockDb];
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
 * Fetch database summary stats/KPI values.
 */
async function getStats() {
  if (submissionsCollection) {
    const total = await submissionsCollection.countDocuments({});
    const approved = await submissionsCollection.countDocuments({ status: 'approved' });
    const pending = await submissionsCollection.countDocuments({ status: 'pending' });
    const locationsList = await submissionsCollection.distinct('location');
    const locations = locationsList ? locationsList.length : 0;
    return { total, approved, pending, uniqueLocations: locations };
  } else {
    const total = mockDb.length;
    const approved = mockDb.filter(r => r.status === 'approved').length;
    const pending = mockDb.filter(r => r.status === 'pending').length;
    const uniqueLocations = [...new Set(mockDb.map(r => r.location))].length;
    return { total, approved, pending, uniqueLocations };
  }
}

module.exports = {
  client,
  isDbConfigured: () => isDbConfigured,
  insertSubmission,
  getSubmissions,
  updateSubmission,
  bulkUpdateSubmissions,
  getStats,
  getMockDb: () => mockDb,
  setMockDb: (data) => { mockDb = data; }
};
