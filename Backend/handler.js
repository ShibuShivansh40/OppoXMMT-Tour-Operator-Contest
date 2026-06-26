const serverless = require('serverless-http');
const app = require('./app');

// Serverless Lambda handler wrapper for AWS Serverless architecture
module.exports.handler = serverless(app);
