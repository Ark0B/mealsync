// Builds the Express app WITHOUT listening, so Supertest can test it on an ephemeral port.
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Security headers. CSP allows our own scripts plus blob:/data: images for QR codes.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      upgradeInsecureRequests: null, // HTTPS is enforced by the host (Render), not here
    },
  },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || false })); // same-origin by default
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

// Interactive API docs (OpenAPI / Swagger UI) at /api-docs
const specPath = path.join(__dirname, '../docs/openapi.yaml');
if (fs.existsSync(specPath)) {
  const swaggerUi = require('swagger-ui-express');
  const YAML = require('yamljs');
  app.use('/api-docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(YAML.load(specPath)));
}

// Front-end (plain HTML/CSS/JS) and the two browser libraries we use.
const vendor = {
  'qrcode.js': '../node_modules/qrcode-generator/dist/qrcode.js',
  'html5-qrcode.min.js': '../node_modules/html5-qrcode/html5-qrcode.min.js',
};
app.get('/vendor/:file', (req, res, next) => {
  const rel = vendor[req.params.file];
  if (!rel) return next();
  res.sendFile(path.join(__dirname, rel));
});
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
