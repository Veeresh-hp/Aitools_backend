// Environment validation utility
// Call early in server startup to ensure required variables are present.

const REQUIRED_VARS = [
  'MONGO_URI',
  'EMAIL_USER',
  'EMAIL_PASS'
];

function checkEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v] || String(process.env[v]).trim() === '');
  if (missing.length) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  } else {
    console.log('✅ Core environment variables validated');
  }
  // Require at least one of FRONTEND_URL or BACKEND_URL
  const hasFrontend = !!(process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim());
  const hasBackend = !!(process.env.BACKEND_URL && process.env.BACKEND_URL.trim());
  if (!hasFrontend && !hasBackend) {
    console.error('❌ FRONTEND_URL or BACKEND_URL must be set for link generation');
  } else if (!hasFrontend) {
    console.warn('ℹ️ FRONTEND_URL missing; falling back to BACKEND_URL for email links');
  } else if (!hasBackend) {
    console.warn('ℹ️ BACKEND_URL missing; unsubscribe links will use FRONTEND_URL');
  }
  if (!process.env.MIN_NEW_TOOL_EMAIL_COUNT) {
    console.log('ℹ️ MIN_NEW_TOOL_EMAIL_COUNT not set; defaulting to 5');
  }
}

module.exports = { checkEnv };