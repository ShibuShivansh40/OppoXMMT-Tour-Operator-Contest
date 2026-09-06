const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

async function runBackup() {
  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.');
    const db = client.db();

    const timestamp = Date.now();
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Backup submissions_migrated
    const submissionsColl = db.collection('submissions_migrated');
    const submissions = await submissionsColl.find({}).toArray();
    const subBackupFile = path.join(backupDir, `submissions_migrated_backup_${timestamp}.json`);
    fs.writeFileSync(subBackupFile, JSON.stringify(submissions, null, 2));
    console.log(`[Backup Success] Dumped ${submissions.length} submissions to ${subBackupFile}`);

    // Backup survey_responses
    const surveyColl = db.collection('survey_responses');
    const surveys = await surveyColl.find({}).toArray();
    const surveyBackupFile = path.join(backupDir, `survey_responses_backup_${timestamp}.json`);
    fs.writeFileSync(surveyBackupFile, JSON.stringify(surveys, null, 2));
    console.log(`[Backup Success] Dumped ${surveys.length} survey responses to ${surveyBackupFile}`);

  } catch (err) {
    console.error('Error during database backup:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

runBackup();
