// auth/jwtCookieScheme.js
const jwt = require('jsonwebtoken');
const Boom = require('@hapi/boom');
const { getFirestore } = require('../config/firebase');

const jwtCookieScheme = (server, options) => {
  return {
    authenticate: async (request, h) => {
      const token = request.headers.authorization?.replace('Bearer ', '') || 
                    request.state.authToken;

      if (!token) {
        throw Boom.unauthorized('Missing authentication token');
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || !decoded.userId) {
          throw Boom.unauthorized('Invalid token structure');
        }

        let db;
        try {
          db = getFirestore();
        } catch (firestoreError) {
          console.error('Firestore connection failed in auth:', firestoreError);
          throw Boom.internal('Database connection failed');
        }

        let userDoc;
        try {
          userDoc = await db.collection('USER').doc(decoded.userId).get();
        } catch (queryError) {
          console.error('User lookup error in auth:', queryError);
          
          if (queryError.code === 5) {
            throw Boom.unauthorized('User database not found');
          } else {
            throw Boom.internal('Failed to verify user');
          }
        }

        if (!userDoc.exists) {
          throw Boom.unauthorized('User not found');
        }

        const userData = userDoc.data();

        return h.authenticated({
          credentials: {
            userId: decoded.userId,
            email: userData.email,
            user: userData
          }
        });
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          throw Boom.unauthorized('Token expired');
        }
        if (error.isBoom) {
          throw error;
        }
        console.error('JWT Auth Error:', error);
        throw Boom.unauthorized('Invalid token');
      }
    }
  };
};

module.exports = jwtCookieScheme;