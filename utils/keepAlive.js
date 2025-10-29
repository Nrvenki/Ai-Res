const https = require('https');

// Self-ping to prevent sleep
const keepAlive = () => {
  const url = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
  
  if (!url) {
    console.log('⚠️ No external URL configured for keep-alive');
    return;
  }

  setInterval(() => {
    https.get(url, (res) => {
      console.log(`✅ Keep-alive ping: ${res.statusCode}`);
    }).on('error', (err) => {
      console.log('⚠️ Keep-alive error:', err.message);
    });
  }, 14 * 60 * 1000); // Every 14 minutes
};

module.exports = keepAlive;
