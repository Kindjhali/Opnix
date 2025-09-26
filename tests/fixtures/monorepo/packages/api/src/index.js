const express = require('express');
const health = require('../../ui/src/health');

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: health() });
});

module.exports = app;
