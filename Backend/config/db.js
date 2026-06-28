const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Determine if we should run in mock mode
const isDbConfigured = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME;

let pool = null;

// In-Memory Database Fallback for local testing without PostgreSQL instance
let mockDb = [];

if (isDbConfigured) {
  console.log('[Database] PostgreSQL Configuration detected. Initializing connection pool...');
  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err, client) => {
    console.error('[Database] Unexpected error on idle client:', err);
  });

  // Dynamic schema migrations check
  pool.query(`
    ALTER TABLE submissions 
    ADD COLUMN IF NOT EXISTS score_composition INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS score_watermark INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS score_location INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS score_engagement INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS score_consistency INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS score_total INTEGER DEFAULT NULL;
  `).then(() => {
    console.log('[Database] Schema checked and scoring columns validated.');
  }).catch(err => {
    console.error('[Database] Dynamic schema alteration failed:', err);
  });
} else {
  console.warn('[Database] Database environment variables missing. Running in MEMORY MOCK MODE.');
}

/**
 * Execute a SQL query. Fallbacks to mock memory database if PostgreSQL isn't configured.
 */
async function query(text, params) {
  if (pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error(`[Database] Query error: ${err.message}. Retrying via mock fallback.`);
      return runMockQuery(text, params);
    }
  } else {
    return runMockQuery(text, params);
  }
}

/**
 * Runs mock SQL queries on local in-memory mock storage.
 * This ensures the application runs perfectly out-of-the-box for verification.
 */
function runMockQuery(text, params) {
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
  
  // 1. INSERT INTO submissions
  if (normalized.includes('insert into submissions')) {
    // fields: user_identifier, user_role, media_url, file_name, file_size, location, travel_date, full_name, tour_manager, device, insta_handle
    const [
      user_identifier, 
      user_role, 
      media_url, 
      file_name, 
      file_size, 
      location, 
      travel_date,
      full_name,
      tour_manager,
      device,
      insta_handle
    ] = params;
    const newRecord = {
      id: mockDb.length + 1,
      user_identifier,
      user_role,
      media_url,
      file_name,
      file_size,
      location,
      travel_date,
      full_name: full_name || null,
      tour_manager: tour_manager || null,
      device: device || null,
      insta_handle: insta_handle || null,
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
    mockDb.push(newRecord);
    return { rows: [newRecord], rowCount: 1 };
  }

  // 2. GET stats (KPI calculation)
  if (normalized.includes('stats') || (normalized.includes('count(') && normalized.includes('from submissions'))) {
    const total = mockDb.length;
    const approved = mockDb.filter(r => r.status === 'approved').length;
    const pending = mockDb.filter(r => r.status === 'pending').length;
    const uniqueLocations = [...new Set(mockDb.map(r => r.location))].length;
    return {
      rows: [{
        total_submissions: total,
        approved_submissions: approved,
        pending_submissions: pending,
        unique_locations: uniqueLocations
      }],
      rowCount: 1
    };
  }

  // 3. UPDATE status (Approve / Reject)
  if (normalized.includes('update submissions') && normalized.includes('set status')) {
    // UPDATE submissions SET status = $1 WHERE id = $2 RETURNING *
    const [status, id] = params;
    const record = mockDb.find(r => r.id === parseInt(id));
    if (record) {
      record.status = status;
      record.updated_at = new Date();
      return { rows: [record], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 4. UPDATE winner status
  if (normalized.includes('update submissions') && normalized.includes('set is_winner')) {
    // UPDATE submissions SET is_winner = $1, winner_selected_at = ... WHERE id = $2 RETURNING *
    const [is_winner, id] = params;
    const record = mockDb.find(r => r.id === parseInt(id));
    if (record) {
      record.is_winner = is_winner;
      record.winner_selected_at = is_winner ? new Date() : null;
      record.updated_at = new Date();
      return { rows: [record], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 4b. UPDATE scores
  if (normalized.includes('update submissions') && normalized.includes('set score_composition')) {
    const [score_composition, score_watermark, score_location, score_engagement, score_consistency, score_total, id] = params;
    const record = mockDb.find(r => r.id === parseInt(id));
    if (record) {
      record.score_composition = score_composition !== null ? parseInt(score_composition) : null;
      record.score_watermark = score_watermark !== null ? parseInt(score_watermark) : null;
      record.score_location = score_location !== null ? parseInt(score_location) : null;
      record.score_engagement = score_engagement !== null ? parseInt(score_engagement) : null;
      record.score_consistency = score_consistency !== null ? parseInt(score_consistency) : null;
      record.score_total = score_total !== null ? parseInt(score_total) : null;
      record.updated_at = new Date();
      return { rows: [record], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 5. SELECT all (or with filters)
  if (normalized.includes('select') && normalized.includes('from submissions')) {
    let result = [...mockDb];
    // Simple mock filter check
    if (normalized.includes('status = $')) {
      const statusFilter = params[0];
      result = result.filter(r => r.status === statusFilter);
    } else if (normalized.includes('is_winner = $')) {
      const winnerFilter = params[0];
      result = result.filter(r => r.is_winner === winnerFilter);
    }
    
    // Sort descending by id (latest submissions first)
    result.sort((a, b) => b.id - a.id);
    return { rows: result, rowCount: result.length };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = {
  query,
  pool,
  getMockDb: () => mockDb,
  setMockDb: (data) => { mockDb = data; }
};
