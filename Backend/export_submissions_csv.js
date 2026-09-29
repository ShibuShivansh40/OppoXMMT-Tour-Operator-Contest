const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function exportSubmissionsToCsv() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is missing');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('submissions_migrated');

    const totalCount = await collection.countDocuments();
    console.log(`Found ${totalCount} documents in 'submissions_migrated'. Fetching all documents...`);

    const cursor = collection.find({}).sort({ id: 1 });
    const docs = await cursor.toArray();

    // Collect all unique keys across all documents to ensure complete CSV coverage
    const keySet = new Set();
    // Preferred column order first
    const preferredOrder = [
      '_id',
      'id',
      'user_identifier',
      'user_role',
      'full_name',
      'tour_manager',
      'location',
      'travel_date',
      'device',
      'insta_handle',
      'file_name',
      'file_size',
      'media_url',
      'thumbnail_url',
      'status',
      'is_winner',
      'winner_selected_at',
      'score_composition',
      'score_watermark',
      'score_location',
      'score_engagement',
      'score_consistency',
      'score_total',
      'created_at'
    ];

    docs.forEach(doc => {
      Object.keys(doc).forEach(k => keySet.add(k));
    });

    const columns = [
      ...preferredOrder.filter(k => keySet.has(k)),
      ...Array.from(keySet).filter(k => !preferredOrder.includes(k))
    ];

    console.log('Columns included in CSV:', columns);

    function escapeCsvField(val) {
      if (val === null || val === undefined) {
        return '';
      }
      if (val instanceof Date) {
        return `"${val.toISOString()}"`;
      }
      if (typeof val === 'object' && val._bsontype) {
        return String(val);
      }
      if (typeof val === 'object') {
        const str = JSON.stringify(val);
        return `"${str.replace(/"/g, '""')}"`;
      }
      let str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const headerLine = columns.join(',');
    const rows = docs.map(doc => {
      return columns.map(col => escapeCsvField(doc[col])).join(',');
    });

    const csvContent = [headerLine, ...rows].join('\r\n');
    const outputPath = path.join(__dirname, 'submissions_migrated.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf8');

    console.log(`CSV successfully created at: ${outputPath}`);
    console.log(`Total rows written: ${docs.length}`);

  } catch (err) {
    console.error('Error exporting CSV:', err);
  } finally {
    await client.close();
  }
}

exportSubmissionsToCsv();
