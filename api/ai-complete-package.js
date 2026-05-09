const { invokeNetlifyStyleHandler } = require('./_netlify-adapter');
const { handler } = require('../netlify/functions/ai-complete-package');

module.exports = async function vercelHandler(req, res) {
  return invokeNetlifyStyleHandler(req, res, handler);
};
