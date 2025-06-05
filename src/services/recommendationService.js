// src/services/recommendationService.js - OPTIMIZED VERSION WITH STRICT CATEGORY + PROVINCE FILTERING
const { getFirestore } = require('../config/firebase');
const { predict, getPredictionDetail, getTourismData, filterTourismData } = require('./mlService');

/**
 * Main recommendation function with strict filtering
 * Only returns places that match BOTH category AND province
 */
const getRecommendations = async (userInterest, userAddress, userId = null) => {
  try {
    console.log('🚀 Starting recommendation process...');
    console.log('🔍 User Interest:', userInterest);
    console.log('📍 User Address:', userAddress);
    
    // Extract province from user address
    const userProvince = extractProvinceFromAddress(userAddress);
    console.log('🌍 Extracted Province:', userProvince);
    
    // Get all tourism data from CSV
    const allTourismData = getTourismData();
    
    if (!allTourismData || allTourismData.length === 0) {
      throw new Error('No tourism data available from CSV');
    }

    console.log('📊 Total Tourism Data Available:', allTourismData.length);

    // STRICT FILTERING: Only kategori + provinsi matches
    const filteredData = applyStrictFiltering(allTourismData, userProvince, userInterest);
    console.log('🎯 After Strict Filtering (Category + Province only):', filteredData.length);

    if (filteredData.length === 0) {
      console.log('⚠️ No exact matches found for category + province combination');
      return {
        recommendations: [],
        total: 0,
        message: `No ${userInterest} destinations found in ${userProvince}. Try different category or province.`,
        userContext: {
          interest: userInterest,
          province: userProvince,
          userId: userId
        },
        filteringStrategy: 'strict_category_province_only',
        dataSource: 'csv_strict_filtered',
        timestamp: new Date().toISOString()
      };
    }

    const recommendations = [];
    
    // Process filtered data for recommendations
    for (const place of filteredData) {
      try {
        // Get ML prediction score
        const score = await predict(userInterest, place.provinsi || userProvince);
        
        // Calculate compatibility score
        const compatibilityScore = calculateCompatibilityScore(score, place);
        
        recommendations.push({
          id: generatePlaceId(place),
          kategori: place.kategori || '',
          nama_wisata: place.nama_wisata || '',
          latitude: parseFloat(place.latitude) || null,
          longitude: parseFloat(place.longitude) || null,
          alamat: place.alamat || '',
          provinsi: place.provinsi || '',
          kota_kabupaten: place.kota_kabupaten || '',
          nama_lengkap: place.nama_lengkap || '',
          deskripsi_bersih: place.deskripsi_bersih || 'Deskripsi tidak tersedia',
          image_path: place.Image_Path || place.image_path || '',
          recommendationScore: score,
          compatibilityScore: compatibilityScore,
          matchReason: `Perfect match: ${userInterest} destination in ${userProvince}`,
          filterType: 'perfect_match'
        });
        
      } catch (predictionError) {
        console.error('Prediction error for place:', place.nama_wisata, predictionError);
        
        // Add with default score if prediction fails
        recommendations.push({
          id: generatePlaceId(place),
          kategori: place.kategori || '',
          nama_wisata: place.nama_wisata || '',
          latitude: parseFloat(place.latitude) || null,
          longitude: parseFloat(place.longitude) || null,
          alamat: place.alamat || '',
          provinsi: place.provinsi || '',
          kota_kabupaten: place.kota_kabupaten || '',
          nama_lengkap: place.nama_lengkap || '',
          deskripsi_bersih: place.deskripsi_bersih || 'Deskripsi tidak tersedia',
          image_path: place.Image_Path || place.image_path || '',
          recommendationScore: 0.7, // Default score for exact matches
          compatibilityScore: 0.7,
          matchReason: `Perfect match: ${userInterest} destination in ${userProvince}`,
          filterType: 'perfect_match'
        });
      }
    }

    // Sort by compatibility score (highest first)
    recommendations.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    // Return top 10 recommendations
    const topRecommendations = recommendations.slice(0, 10);
    
    console.log('✅ Final Recommendations Count:', topRecommendations.length);
    
    return {
      recommendations: topRecommendations,
      total: recommendations.length,
      perfectMatchCount: topRecommendations.length, // All are perfect matches
      userContext: {
        interest: userInterest,
        province: userProvince,
        userId: userId
      },
      filteringStrategy: 'strict_category_province_only',
      dataSource: 'csv_strict_filtered',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error;
  }
};

/**
 * Apply strict filtering - ONLY category + province matches
 */
const applyStrictFiltering = (allData, userProvince, userInterest) => {
  console.log('🎯 Applying STRICT Filtering...');
  console.log('   - Target Province:', userProvince);
  console.log('   - Target Category:', userInterest);
  
  const filtered = allData.filter(place => {
    // Both category and province must match exactly
    const categoryMatch = place.kategori && 
      place.kategori.toLowerCase().trim() === userInterest.toLowerCase().trim();
    
    const provinceMatch = place.provinsi && 
      normalizeProvinceName(place.provinsi) === normalizeProvinceName(userProvince);
    
    const isValid = categoryMatch && provinceMatch;
    
    if (isValid) {
      console.log(`✅ Match found: ${place.nama_wisata} - ${place.kategori} in ${place.provinsi}`);
    }
    
    return isValid;
  });
  
  console.log('🎯 Strict filtering results:', filtered.length);
  return filtered;
};

/**
 * Enhanced province extraction with Indonesian province patterns
 */
const extractProvinceFromAddress = (address) => {
  if (!address) return 'Unknown';
  
  console.log('🔍 Extracting province from:', address);
  
  const cleanAddress = address.toLowerCase().trim();
  
  // Indonesian province patterns
  const provincePatterns = {
    'jawa barat': ['jawa barat', 'jabar', 'west java', 'bandung', 'bogor', 'depok', 'bekasi', 'cimahi', 'sukabumi', 'cirebon', 'tasikmalaya', 'garut'],
    'jawa tengah': ['jawa tengah', 'jateng', 'central java', 'semarang', 'solo', 'surakarta', 'magelang', 'salatiga', 'pekalongan', 'tegal'],
    'jawa timur': ['jawa timur', 'jatim', 'east java', 'surabaya', 'malang', 'kediri', 'blitar', 'madiun', 'mojokerto', 'pasuruan', 'probolinggo'],
    'dki jakarta': ['jakarta', 'dki jakarta', 'jakarta pusat', 'jakarta utara', 'jakarta selatan', 'jakarta timur', 'jakarta barat', 'kepulauan seribu'],
    'banten': ['banten', 'tangerang', 'serang', 'cilegon', 'lebak', 'pandeglang', 'tangerang selatan'],
    'di yogyakarta': ['yogyakarta', 'jogja', 'yogya', 'diy', 'sleman', 'bantul', 'kulonprogo', 'gunungkidul'],
    'bali': ['bali', 'denpasar', 'ubud', 'kuta', 'sanur', 'badung', 'gianyar', 'tabanan', 'klungkung', 'bangli'],
    'sumatera utara': ['sumatera utara', 'sumut', 'medan', 'north sumatra', 'pematangsiantar', 'binjai', 'tebing tinggi', 'tanjungbalai'],
    'sumatera barat': ['sumatera barat', 'sumbar', 'padang', 'west sumatra', 'bukittinggi', 'payakumbuh', 'padangpanjang'],
    'sumatera selatan': ['sumatera selatan', 'sumsel', 'palembang', 'south sumatra', 'lubuklinggau', 'pagar alam', 'prabumulih'],
    'lampung': ['lampung', 'bandar lampung', 'metro'],
    'riau': ['riau', 'pekanbaru', 'dumai'],
    'kepulauan riau': ['kepulauan riau', 'kepri', 'batam', 'tanjungpinang'],
    'jambi': ['jambi', 'sungai penuh'],
    'bengkulu': ['bengkulu'],
    'aceh': ['aceh', 'banda aceh', 'langsa', 'lhokseumawe', 'sabang'],
    'kalimantan barat': ['kalimantan barat', 'kalbar', 'pontianak', 'singkawang'],
    'kalimantan tengah': ['kalimantan tengah', 'kalteng', 'palangkaraya'],
    'kalimantan selatan': ['kalimantan selatan', 'kalsel', 'banjarmasin', 'banjarbaru'],
    'kalimantan timur': ['kalimantan timur', 'kaltim', 'samarinda', 'balikpapan', 'bontang'],
    'kalimantan utara': ['kalimantan utara', 'kalut', 'tanjung selor'],
    'sulawesi selatan': ['sulawesi selatan', 'sulsel', 'makassar', 'parepare', 'palopo'],
    'sulawesi utara': ['sulawesi utara', 'sulut', 'manado', 'bitung', 'tomohon', 'kotamobagu'],
    'sulawesi tengah': ['sulawesi tengah', 'sulteng', 'palu'],
    'sulawesi tenggara': ['sulawesi tenggara', 'sultra', 'kendari', 'bau-bau'],
    'sulawesi barat': ['sulawesi barat', 'sulbar', 'mamuju'],
    'gorontalo': ['gorontalo'],
    'papua': ['papua', 'jayapura'],
    'papua barat': ['papua barat', 'manokwari', 'sorong'],
    'papua barat daya': ['papua barat daya'],
    'papua selatan': ['papua selatan'],
    'papua tengah': ['papua tengah'],
    'papua pegunungan': ['papua pegunungan'],
    'nusa tenggara barat': ['nusa tenggara barat', 'ntb', 'mataram', 'bima', 'lombok'],
    'nusa tenggara timur': ['nusa tenggara timur', 'ntt', 'kupang', 'flores', 'ende'],
    'maluku': ['maluku', 'ambon', 'tual'],
    'maluku utara': ['maluku utara', 'ternate', 'tidore']
  };
  
  // Find matching province
  for (const [province, patterns] of Object.entries(provincePatterns)) {
    for (const pattern of patterns) {
      if (cleanAddress.includes(pattern)) {
        console.log('✅ Province matched:', province, 'via pattern:', pattern);
        return province;
      }
    }
  }
  
  // Fallback: extract from comma-separated format
  const parts = address.split(',').map(part => part.trim());
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    console.log('⚠️ Fallback extraction, using last part:', lastPart);
    return lastPart;
  }
  
  console.log('❌ Could not extract province, using full address');
  return address.trim();
};

/**
 * Normalize province names for consistent matching
 */
const normalizeProvinceName = (provinceName) => {
  if (!provinceName) return '';
  
  const normalized = provinceName.toLowerCase().trim();
  
  // Handle common abbreviations and variations
  const variations = {
    'jabar': 'jawa barat',
    'jateng': 'jawa tengah', 
    'jatim': 'jawa timur',
    'jakarta': 'dki jakarta',
    'jogja': 'di yogyakarta',
    'yogya': 'di yogyakarta',
    'diy': 'di yogyakarta',
    'sumut': 'sumatera utara',
    'sumbar': 'sumatera barat',
    'sumsel': 'sumatera selatan',
    'kepri': 'kepulauan riau',
    'kalbar': 'kalimantan barat',
    'kalteng': 'kalimantan tengah',
    'kalsel': 'kalimantan selatan',
    'kaltim': 'kalimantan timur',
    'kalut': 'kalimantan utara',
    'sulsel': 'sulawesi selatan',
    'sulut': 'sulawesi utara',
    'sulteng': 'sulawesi tengah',
    'sultra': 'sulawesi tenggara',
    'sulbar': 'sulawesi barat',
    'ntb': 'nusa tenggara barat',
    'ntt': 'nusa tenggara timur'
  };
  
  return variations[normalized] || normalized;
};

/**
 * Calculate compatibility score based on ML prediction and place attributes
 */
const calculateCompatibilityScore = (mlScore, place) => {
  let compatibilityScore = mlScore || 0.7;
  
  // All results are perfect matches (category + province), so base score is high
  compatibilityScore = Math.max(compatibilityScore, 0.8);
  
  // Boost score if place has complete information
  if (place.deskripsi_bersih && place.deskripsi_bersih.trim() !== '' && place.deskripsi_bersih.length > 10) {
    compatibilityScore += 0.05;
  }
  
  if (place.Image_Path && place.Image_Path.trim() !== '') {
    compatibilityScore += 0.05;
  }
  
  if (place.latitude && place.longitude) {
    compatibilityScore += 0.05;
  }
  
  // Ensure score doesn't exceed 1.0
  return Math.min(compatibilityScore, 1.0);
};

/**
 * Generate unique ID for places - adjusted for CSV headers
 */
const generatePlaceId = (place) => {
  const baseString = `${place.nama_wisata || 'unknown'}_${place.provinsi || 'unknown'}_${place.kategori || 'unknown'}`;
  return baseString.toLowerCase().replace(/[^a-z0-9]/g, '_');
};

/**
 * Get filtered recommendations with additional filters
 */
const getFilteredRecommendations = async (userInterest, userAddress, filters = {}) => {
  try {
    const userProvince = extractProvinceFromAddress(userAddress);
    
    let filteredData = getTourismData();
    
    // Apply strict category + province filtering first
    const targetProvince = filters.provinsi || userProvince;
    const targetCategory = filters.kategori || userInterest;
    
    console.log('🔍 Filtering with:', { targetProvince, targetCategory });
    
    filteredData = applyStrictFiltering(filteredData, targetProvince, targetCategory);
    
    // Apply additional filters if any
    if (filters.kota_kabupaten) {
      filteredData = filteredData.filter(place => 
        place.kota_kabupaten && 
        place.kota_kabupaten.toLowerCase().includes(filters.kota_kabupaten.toLowerCase())
      );
      console.log(`🏙️ Filtered by city: ${filteredData.length}`);
    }
    
    const recommendations = [];
    
    for (const place of filteredData) {
      try {
        const score = await predict(targetCategory, place.provinsi);
        const compatibilityScore = calculateCompatibilityScore(score, place);
        
        recommendations.push({
          id: generatePlaceId(place),
          kategori: place.kategori || '',
          nama_wisata: place.nama_wisata || '',
          latitude: parseFloat(place.latitude) || null,
          longitude: parseFloat(place.longitude) || null,
          alamat: place.alamat || '',
          provinsi: place.provinsi || '',
          kota_kabupaten: place.kota_kabupaten || '',
          nama_lengkap: place.nama_lengkap || '',
          deskripsi_bersih: place.deskripsi_bersih || 'Deskripsi tidak tersedia',
          image_path: place.Image_Path || place.image_path || '',
          recommendationScore: score,
          compatibilityScore: compatibilityScore,
          matchReason: `Perfect match: ${targetCategory} in ${targetProvince}`,
          filterType: 'perfect_match'
        });
      } catch (error) {
        console.error('Prediction error:', error);
      }
    }
    
    // Sort by compatibility score
    recommendations.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    return {
      recommendations: recommendations.slice(0, 10),
      total: recommendations.length,
      appliedFilters: {
        ...filters,
        effectiveProvince: targetProvince,
        effectiveCategory: targetCategory
      },
      userContext: { interest: userInterest, province: userProvince },
      filteringStrategy: 'strict_category_province_only',
      dataSource: 'csv_strict_filtered'
    };
    
  } catch (error) {
    console.error('Error getting filtered recommendations:', error);
    throw error;
  }
};

/**
 * Get personalized recommendations for registered users
 */
const getPersonalizedRecommendations = async (userId) => {
  try {
    const db = getFirestore();
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    if (!userData.interest || !userData.address) {
      throw new Error('User profile incomplete - interest and address required');
    }
    
    console.log('👤 Getting personalized recommendations for user:', userId);
    
    const baseRecommendations = await getRecommendations(
      userData.interest, 
      userData.address, 
      userId
    );
    
    // Exclude previously visited places if visit history exists
    try {
      const visitsSnapshot = await db.collection('user_visits')
        .where('userId', '==', userId)
        .get();
      
      if (!visitsSnapshot.empty) {
        const visitedPlaceIds = visitsSnapshot.docs.map(doc => doc.data().placeId);
        
        const newRecommendations = baseRecommendations.recommendations.filter(
          rec => !visitedPlaceIds.includes(rec.id.toString())
        );
        
        return {
          ...baseRecommendations,
          recommendations: newRecommendations,
          visitHistory: visitedPlaceIds.length,
          excludedVisited: visitedPlaceIds.length
        };
      }
    } catch (visitError) {
      console.log('No visit history found:', visitError.message);
    }
    
    return baseRecommendations;
    
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    throw error;
  }
};

/**
 * Get recommendations by specific category
 */
const getRecommendationsByCategory = async (userAddress, kategori) => {
  try {
    return await getFilteredRecommendations(kategori, userAddress, { kategori });
  } catch (error) {
    console.error('Error getting category recommendations:', error);
    throw error;
  }
};

/**
 * Get available categories from the dataset
 */
const getAvailableCategories = () => {
  try {
    const allData = getTourismData();
    const categories = [...new Set(allData.map(place => place.kategori).filter(Boolean))];
    return categories.sort();
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
};

/**
 * Get available provinces from the dataset
 */
const getAvailableProvinces = () => {
  try {
    const allData = getTourismData();
    const provinces = [...new Set(allData.map(place => place.provinsi).filter(Boolean))];
    return provinces.sort();
  } catch (error) {
    console.error('Error getting provinces:', error);
    return [];
  }
};

module.exports = { 
  getRecommendations, 
  getPersonalizedRecommendations,
  getFilteredRecommendations,
  getRecommendationsByCategory,
  getAvailableCategories,
  getAvailableProvinces,
  extractProvinceFromAddress,
  normalizeProvinceName,
  applyStrictFiltering,
  calculateCompatibilityScore,
  generatePlaceId
};