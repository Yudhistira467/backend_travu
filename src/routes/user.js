// src/routes/user.js - FIXED VERSION
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const { getFirestore } = require('../config/firebase');

const userRoutes = [
  {
    method: 'GET',
    path: '/api/user/profile',
    handler: async (request, h) => {
      try {
        const { userId } = request.auth.credentials;
        const db = getFirestore();

        // FIXED: Menggunakan 'USER' konsisten dengan auth.js
        const userDoc = await db.collection('USER').doc(userId).get();
        
        if (!userDoc.exists) {
          throw Boom.notFound('User not found');
        }

        const userData = userDoc.data();
        delete userData.password; // Don't return password

        return {
          success: true,
          data: {
            userId,
            ...userData
          }
        };
      } catch (error) {
        console.error('Get profile error:', error); // Added logging
        if (error.isBoom) throw error;
        throw Boom.internal('Failed to get profile');
      }
    }
  },
  {
    method: 'PUT',
    path: '/api/user/profile',
    options: {
      validate: {
        payload: Joi.object({
          interest: Joi.string().allow(''),
          address: Joi.string().allow(''),
          phoneNumber: Joi.string().allow('')
        })
      }
    },
    handler: async (request, h) => {
      try {
        const { userId } = request.auth.credentials;
        const { interest, address, phoneNumber } = request.payload;
        const db = getFirestore();

        const updateData = {
          updatedAt: new Date()
        };

        if (interest !== undefined) updateData.interest = interest;
        if (address !== undefined) updateData.address = address;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

        // FIXED: Menggunakan 'USER' konsisten dengan auth.js
        await db.collection('USER').doc(userId).update(updateData);

        return {
          success: true,
          message: 'Profile updated successfully',
          data: updateData
        };
      } catch (error) {
        console.error('Update profile error:', error); // Added logging
        if (error.isBoom) throw error;
        throw Boom.internal('Failed to update profile');
      }
    }
  },
  // Tambahan: Test endpoint untuk debug
  {
    method: 'GET',
    path: '/api/user/test-auth',
    handler: async (request, h) => {
      try {
        console.log('Auth credentials:', request.auth);
        
        return {
          success: true,
          message: 'Auth test successful',
          auth: request.auth ? request.auth.credentials : 'No auth found'
        };
      } catch (error) {
        console.error('Auth test error:', error);
        throw Boom.internal('Auth test failed');
      }
    }
  }
];

module.exports = userRoutes;