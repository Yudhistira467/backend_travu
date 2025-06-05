// src/routes/recommendation.js
const Boom = require('@hapi/boom');
const {
  getRecommendations,
  getPersonalizedRecommendations,
  getFilteredRecommendations,
  getRecommendationsByCategory
} = require('../services/recommendationService');

const recommendationRoutes = [
  {
    method: 'GET',
    path: '/api/recommendations',
    handler: async (request, h) => {
      try {
        const { userId, user } = request.auth.credentials;

        if (!user.interest || !user.address) {
          throw Boom.badRequest('Interest and address must be set in profile');
        }

        const recommendations = await getRecommendations(user.interest, user.address, userId);

        return {
          success: true,
          data: recommendations
        };
      } catch (error) {
        console.error('Recommendation route error:', error);
        if (error.isBoom) throw error;
        throw Boom.internal('Failed to get recommendations');
      }
    }
  },
  {
    method: 'GET',
    path: '/api/recommendations/category/{kategori}',
    handler: async (request, h) => {
      try {
        const { kategori } = request.params;
        const { address } = request.query;

        if (!address) {
          throw Boom.badRequest('Address parameter is required');
        }

        const recommendations = await getRecommendationsByCategory(address, kategori);

        return {
          success: true,
          data: recommendations
        };
      } catch (error) {
        console.error('Category recommendation error:', error);
        if (error.isBoom) throw error;
        throw Boom.internal('Failed to get category recommendations');
      }
    }
  },
  {
    method: 'GET',
    path: '/api/recommendations/filtered',
    handler: async (request, h) => {
      try {
        const { interest, address, kategori, provinsi, minRating } = request.query;

        if (!interest || !address) {
          throw Boom.badRequest('Interest and address parameters are required');
        }

        const filters = {};
        if (kategori) filters.kategori = kategori;
        if (provinsi) filters.provinsi = provinsi;
        if (minRating) filters.minRating = parseFloat(minRating);

        const recommendations = await getFilteredRecommendations(interest, address, filters);

        return {
          success: true,
          data: recommendations
        };
      } catch (error) {
        console.error('Filtered recommendation error:', error);
        if (error.isBoom) throw error;
        throw Boom.internal('Failed to get filtered recommendations');
      }
    }
  },
  {
    method: 'GET',
    path: '/api/recommend/{userId}',
    handler: async (request, h) => {
      try {
        const userId = request.params.userId;

        const { getFirestore } = require('../config/firebase');
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
          throw Boom.notFound('User not found');
        }

        const userData = userDoc.data();
        if (!userData.interest || !userData.address) {
          throw Boom.badRequest('User must have interest and address set in profile');
        }

        const recommendations = await getRecommendations(userData.interest, userData.address, userId);

        return {
          success: true,
          data: recommendations
        };
      } catch (error) {
        console.error('Individual recommendation error:', error);
        if (error.isBoom) throw error;
        throw Boom.internal('Failed to get user recommendations');
      }
    }
  },
  {
    method: 'GET',
    path: '/api/health',
    handler: () => ({
      success: true,
      status: 'Recommendation API is running',
      timestamp: new Date().toISOString()
    })
  }
];

module.exports = recommendationRoutes;