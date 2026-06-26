const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const apiRouter = require('./routes/api');

const app = express();

// Express Middlewares (ORDER MATTERS: cors and json must come before static)
app.use(cors()); // Allow CORS requests from frontend clients
app.use(express.json()); // Support JSON body payloads
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../Frontend')));

// Healthcheck Route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'OPPO x MakeMyTrip UGC Campaign API Server is running.',
    environment: process.env.NODE_ENV || 'development',
    serverless: !!process.env.AWS_LAMBDA_FUNCTION_NAME
  });
});

// API Routes mounting
app.use('/api', apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Express Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start listener only when running directly (not via AWS Lambda serverless wrapper)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`  OPPO x MakeMyTrip UGC Campaign Server listening on port ${PORT}`);
    console.log(`  Local Address: http://localhost:${PORT}`);
    console.log(`================================================================`);

    // Programmatic ngrok integration
    if (process.env.START_NGROK === 'true') {
      const { spawn } = require('child_process');
      const http = require('http');
      const ngrokPath = process.env.NGROK_PATH || 'D:\\Downloads\\ngrok-v3-stable-windows-amd64\\ngrok.exe';

      console.log(`[ngrok] Launching tunnel client from: ${ngrokPath}...`);
      
      const ngrokProcess = spawn(ngrokPath, ['http', PORT], {
        detached: true,
        stdio: 'ignore'
      });
      ngrokProcess.unref();

      // Poll ngrok local API to extract the public URL
      const pollTunnels = () => {
        setTimeout(() => {
          http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (json.tunnels && json.tunnels.length > 0) {
                  const publicUrl = json.tunnels[0].public_url;
                  console.log(`\n================================================================`);
                  console.log(`  🚀 PUBLIC NGROK TUNNEL ONLINE`);
                  console.log(`  Public Link: ${publicUrl}`);
                  console.log(`  Traveler Page: ${publicUrl}/Traveler_Landing_Page/index.html`);
                  console.log(`  Operator Page: ${publicUrl}/Operator_Landing_Page/index.html`);
                  console.log(`  MMT Dashboard: ${publicUrl}/MMT_Dashboard/index.html`);
                  console.log(`================================================================\n`);
                } else {
                  pollTunnels();
                }
              } catch (e) {
                pollTunnels();
              }
            });
          }).on('error', () => {
            pollTunnels(); // Retry if local API is not ready yet
          });
        }, 1000);
      };

      pollTunnels();
    }
  });
}

module.exports = app;
