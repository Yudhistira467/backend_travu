// routes/auth.js
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getFirestore } = require('../config/firebase');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const authRoutes = [
  {
    method: 'POST',
    path: '/api/auth/register',
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().min(6).required(),
          name: Joi.string().required(),
          rememberMe: Joi.boolean().default(false)
        })
      }
    },
    handler: async (request, h) => {
      try {
        const { email, password, name, rememberMe } = request.payload;
        
        // Test koneksi Firestore terlebih dahulu
        let db;
        try {
          db = getFirestore();
          console.log('Firestore connection established');
        } catch (firestoreError) {
          console.error('Firestore connection failed:', firestoreError);
          throw Boom.internal('Database connection failed');
        }

        // Cek apakah user sudah ada
        let existingUser;
        try {
          existingUser = await db.collection('USER')
            .where('email', '==', email)
            .get();
          
          console.log('User check query executed successfully');
        } catch (queryError) {
          console.error('User query error:', queryError);
          
          // Jika error adalah NOT_FOUND (code 5), collection mungkin belum ada
          if (queryError.code === 5) {
            console.log('USER collection does not exist yet, will be created');
            existingUser = { empty: true }; // Simulasi empty result
          } else {
            throw Boom.internal('Failed to check existing user');
          }
        }

        if (!existingUser.empty) {
          throw Boom.conflict('User already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
          address: '',
          createdAt: new Date(),
          email,
          interest: '',
          name,
          password: hashedPassword,
          phoneNumber: '',
          saleslve: true,
          updatedAt: new Date()
        };

        // Tambahkan user baru
        let userRef;
        try {
          userRef = await db.collection('USER').add(userData);
          console.log('User created successfully with ID:', userRef.id);
        } catch (createError) {
          console.error('User creation error:', createError);
          throw Boom.internal('Failed to create user');
        }

        // Buat JWT token
        const tokenPayload = { userId: userRef.id, email };
        const tokenOptions = rememberMe ? { expiresIn: '30d' } : { expiresIn: '24h' };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, tokenOptions);

        const response = h.response({
          success: true,
          message: 'User registered successfully',
          data: {
            userId: userRef.id,
            email,
            name,
            saleslve: true,
            token
          }
        }).code(201);

        if (rememberMe) {
          response.state('authToken', token, {
            ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
            isSecure: process.env.NODE_ENV === 'production',
            isHttpOnly: true,
            isSameSite: 'Lax'
          });
        }

        return response;
      } catch (error) {
        if (error.isBoom) throw error;
        console.error('Register error:', error);
        
        // Berikan informasi error yang lebih spesifik
        if (error.code === 5) {
          throw Boom.internal('Database not found or not accessible. Please check Firebase configuration.');
        } else if (error.code === 7) {
          throw Boom.forbidden('Permission denied. Please check Firebase rules.');
        } else {
          throw Boom.internal('Registration failed');
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().required(),
          rememberMe: Joi.boolean().default(false)
        })
      }
    },
    handler: async (request, h) => {
      try {
        const { email, password, rememberMe } = request.payload;
        
        let db;
        try {
          db = getFirestore();
        } catch (firestoreError) {
          console.error('Firestore connection failed:', firestoreError);
          throw Boom.internal('Database connection failed');
        }

        let userQuery;
        try {
          userQuery = await db.collection('USER')
            .where('email', '==', email)
            .get();
        } catch (queryError) {
          console.error('Login query error:', queryError);
          
          if (queryError.code === 5) {
            throw Boom.unauthorized('Invalid credentials - User database not found');
          } else {
            throw Boom.internal('Failed to authenticate user');
          }
        }

        if (userQuery.empty) {
          throw Boom.unauthorized('Invalid credentials');
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();

        const isValidPassword = await bcrypt.compare(password, userData.password);
        if (!isValidPassword) {
          throw Boom.unauthorized('Invalid credentials');
        }

        // Update last login
        try {
          await userDoc.ref.update({ updatedAt: new Date() });
        } catch (updateError) {
          console.warn('Failed to update last login time:', updateError);
          // Don't throw error for this, just log it
        }

        const tokenPayload = { userId: userDoc.id, email };
        const tokenOptions = rememberMe ? { expiresIn: '30d' } : { expiresIn: '24h' };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, tokenOptions);

        const response = h.response({
          success: true,
          message: 'Login successful',
          data: {
            userId: userDoc.id,
            email: userData.email,
            name: userData.name,
            interest: userData.interest,
            address: userData.address,
            phoneNumber: userData.phoneNumber,
            saleslve: userData.saleslve,
            token
          }
        });

        if (rememberMe) {
          response.state('authToken', token, {
            ttl: 30 * 24 * 60 * 60 * 1000,
            isSecure: process.env.NODE_ENV === 'production',
            isHttpOnly: true,
            isSameSite: 'Lax'
          });
        }

        return response;
      } catch (error) {
        if (error.isBoom) throw error;
        console.error('Login error:', error);
        
        if (error.code === 5) {
          throw Boom.internal('Database not found or not accessible');
        } else if (error.code === 7) {
          throw Boom.forbidden('Permission denied');
        } else {
          throw Boom.internal('Login failed');
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    options: {
      auth: false
    },
    handler: async (request, h) => {
      return h.response({
        success: true,
        message: 'Logout successful'
      }).unstate('authToken');
    }
  },
  // Tambah route untuk test database connection
  {
    method: 'GET',
    path: '/api/auth/test-db',
    options: {
      auth: false
    },
    handler: async (request, h) => {
      try {
        const db = getFirestore();
        
        // Test simple query
        const testQuery = await db.collection('USER').limit(1).get();
        
        return {
          success: true,
          message: 'Database connection successful',
          database: process.env.FIRESTORE_DATABASE_ID || 'default',
          project: process.env.FIREBASE_PROJECT_ID,
          collectionExists: !testQuery.empty,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Database test error:', error);
        
        return h.response({
          success: false,
          message: 'Database connection failed',
          error: error.message,
          code: error.code,
          database: process.env.FIRESTORE_DATABASE_ID || 'default',
          project: process.env.FIREBASE_PROJECT_ID
        }).code(500);
      }
    }
  }
];

module.exports = authRoutes;