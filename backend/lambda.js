// Serverless entry point (Netlify Functions / AWS Lambda).
// Lives in backend/ so its dependencies resolve from backend/node_modules.
const serverless = require('serverless-http');
const app = require('./app');

module.exports.handler = serverless(app);
