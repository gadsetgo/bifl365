const https = require('https');
require('dotenv').config({ path: '.env.local' });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.log("No key");
  process.exit(1);
}

const data = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: "Say hello world" }] }]
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  port: 443,
  path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log("Sending request...");
const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
