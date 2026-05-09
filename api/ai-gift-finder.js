const { invokeNetlifyStyleHandler } = require('./_netlify-adapter');
const { handler } = require('../netlify/functions/ai-gift-finder');

module.exports = async function vercelHandler(req, res) {
  return invokeNetlifyStyleHandler(req, res, handler);
};
