// Envuelve app.json: activa Firebase (notificaciones push) solo si existe google-services.json,
// para que la compilación no falle antes de configurarlo.
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(googleServices)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } };
};
