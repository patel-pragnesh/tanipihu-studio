async function invokeNetlifyStyleHandler(req, res, netlifyHandler) {
  const event = {
    httpMethod: req.method,
    headers: req.headers || {},
    body:
      req.body == null
        ? ''
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)
  };

  const result = await netlifyHandler(event);
  const statusCode = Number(result?.statusCode || 200);
  const headers = result?.headers || { 'Content-Type': 'application/json' };
  const body = result?.body == null ? '' : String(result.body);

  Object.entries(headers).forEach(([key, value]) => {
    if (value != null) {
      res.setHeader(key, value);
    }
  });

  res.status(statusCode).send(body);
}

module.exports = { invokeNetlifyStyleHandler };
