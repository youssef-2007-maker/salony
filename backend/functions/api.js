// Netlify Function: runs the whole Salony API (Express) as one serverless
// function. netlify.toml rewrites /api/* here.
exports.handler = require('../lambda').handler;
