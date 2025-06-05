// src/utils/validation.js
const Joi = require('@hapi/joi');

const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(50).required(),
    rememberMe: Joi.boolean().default(false)
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false)
  }),
  
  updateProfile: Joi.object({
    interest: Joi.string().valid(
      'Bahari', 'Budaya', 'Cagar Alam', 
      'Pusat Perbelanjaan', 'Taman Hiburan', 'Tempat Ibadah'
    ).allow(''),
    address: Joi.string().max(255).allow(''),
    phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow('')
  })
};

module.exports = schemas;