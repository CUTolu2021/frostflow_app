const healthHandler = (_req, res) => {
  res.json({ status: 'ok' });
};

module.exports = { healthHandler };
