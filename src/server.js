// server.js
// Load environment variables at the very beginning
const dotenv = require('dotenv');
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('✅ Environment variables loaded');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('🏗️  Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
console.log('🗃️  Firestore Database ID:', process.env.FIRESTORE_DATABASE_ID || 'default');

const Hapi = require('@hapi/hapi');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const recommendationRoutes = require('./routes/recommendation');
const { initializeFirebase, testFirestoreConnection, ensureUserCollection } = require('./config/firebase');
const { loadModel } = require('./services/mlService');

const init = async () => {
  console.log('🚀 Starting server initialization...');
  
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    routes: {
      cors: {
        origin: ['*'],
        headers: ['Accept', 'Authorization', 'Content-Type', 'If-None-Match'],
        credentials: true
      }
    }
  });

  try {
    // Initialize Firebase
    console.log('🔥 Initializing Firebase...');
    await initializeFirebase();
    console.log('✅ Firebase initialized successfully');

    // Test Firestore connection
    console.log('🗃️  Testing Firestore connection...');
    const connectionTest = await testFirestoreConnection();
    if (connectionTest) {
      console.log('✅ Firestore connection successful');
    } else {
      console.warn('⚠️  Firestore connection test failed, but continuing...');
    }

    // Ensure USER collection exists
    console.log('👤 Checking USER collection...');
    await ensureUserCollection();

    // Load ML Model
    console.log('🤖 Loading ML Model...');
    try {
      await loadModel();
      console.log('✅ ML Model loaded successfully');
    } catch (mlError) {
      console.warn('⚠️  ML Model loading failed:', mlError.message);
      console.warn('⚠️  Continuing without ML model...');
    }

    // Register cookie plugin
    await server.register(require('@hapi/cookie'));

    // Register custom jwt-cookie scheme and strategy
    server.auth.scheme('jwt-cookie', require('./auth/jwtCookieScheme'));
    server.auth.strategy('jwt', 'jwt-cookie');
    server.auth.default('jwt');

    // Register routes
    server.route([
      ...authRoutes,
      ...userRoutes,
      ...recommendationRoutes
    ]);

    // Add health check route
    server.route({
      method: 'GET',
      path: '/health',
      options: { auth: false },
      handler: async (request, h) => {
        const { getFirestore } = require('./config/firebase');
        
        let dbStatus = 'disconnected';
        try {
          const db = getFirestore();
          await db.collection('_health').limit(1).get();
          dbStatus = 'connected';
        } catch (error) {
          dbStatus = `error: ${error.message}`;
        }

        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: dbStatus,
          project: process.env.FIREBASE_PROJECT_ID,
          databaseId: process.env.FIRESTORE_DATABASE_ID || 'default'
        };
      }
    });

    // Global error handling response
    server.ext('onPreResponse', (request, h) => {
      const response = request.response;
      if (response.isBoom) {
        const statusCode = response.output.statusCode;
        const error = response.output.payload;
        
        // Log error untuk debugging
        console.error(`❌ ${request.method.toUpperCase()} ${request.path} - ${statusCode}: ${error.message}`);
        
        return h.response({
          success: false,
          message: error.message,
          error: statusCode === 500 ? 'Internal Server Error' : error.error,
          statusCode: statusCode
        }).code(statusCode);
      }
      return h.continue;
    });

    await server.start();
    console.log('🎉 Server running successfully!');
    console.log(`📍 Server URL: ${server.info.uri}`);
    console.log(`🏗️  Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`🗃️  Firestore Database: ${process.env.FIRESTORE_DATABASE_ID || 'default'}`);
    console.log('');
    console.log('📡 Available endpoints:');
    console.log('  - GET  /health                    - Health check');
    console.log('  - GET  /api/auth/test-db          - Test database connection');
    console.log('  - POST /api/auth/register         - User registration');
    console.log('  - POST /api/auth/login            - User login');
    console.log('  - POST /api/auth/logout           - User logout');
    console.log('  - GET  /api/user/profile          - Get user profile');
    console.log('  - PUT  /api/user/profile          - Update user profile');
    console.log('  - GET  /api/recommendations       - Get recommendations');
    console.log('');
    console.log('🔧 Debugging tips:');
    console.log('  - Test database: GET /api/auth/test-db');
    console.log('  - Check health: GET /health');
    console.log('');

  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('  1. Check if service-account-key.json exists');
    console.error('  2. Verify Firebase project ID is correct');
    console.error('  3. Ensure Firestore database "travu" exists');
    console.error('  4. Check Firebase IAM permissions');
    console.error('');
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

init();