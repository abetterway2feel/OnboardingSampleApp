const { createApp } = require('./api/app');

const app = createApp();
const PORT = process.env.PORT || 3001;

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Onboarding API server running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
