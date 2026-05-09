const { invokeNetlifyStyleHandler } = require('./_netlify-adapter');
const { handler } = require('../netlify/functions/admin-save-overrides');

module.exports = async function vercelHandler(req, res) {
  return invokeNetlifyStyleHandler(req, res, handler);
};
