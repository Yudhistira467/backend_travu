// src/services/mlService.js
const tf = require('@tensorflow/tfjs-node');
const Papa = require('papaparse');
const path = require('path');
const fs = require('fs');

let model = null;
let isInitialized = false;
let tourismData = []; // Data tourism dari CSV

// Mapping untuk kategori dan provinsi
const KATEGORI_MAPPING = {
  'Bahari': 0,
  'Budaya': 1,
  'Cagar Alam': 2,
  'Pusat Perbelanjaan': 3,
  'Taman Hiburan': 4,
  'Tempat Ibadah': 5
};

const PROVINSI_MAPPING = {
  'Aceh': 0,
  'Sumatera Utara': 1,
  'Sumatera Barat': 2,
  'Riau': 3,
  'Jambi': 4,
  'Sumatera Selatan': 5,
  'Bengkulu': 6,
  'Lampung': 7,
  'Kepulauan Bangka Belitung': 8,
  'Kepulauan Riau': 9,
  'DKI Jakarta': 10,
  'Jawa Barat': 11,
  'Jawa Tengah': 12,
  'DI Yogyakarta': 13,
  'Jawa Timur': 14,
  'Banten': 15,
  'Bali': 16,
  'Nusa Tenggara Barat': 17,
  'Nusa Tenggara Timur': 18,
  'Kalimantan Barat': 19,
  'Kalimantan Tengah': 20,
  'Kalimantan Selatan': 21,
  'Kalimantan Timur': 22,
  'Kalimantan Utara': 23,
  'Sulawesi Utara': 24,
  'Sulawesi Tengah': 25,
  'Sulawesi Selatan': 26,
  'Sulawesi Tenggara': 27,
  'Gorontalo': 28,
  'Sulawesi Barat': 29,
  'Maluku': 30,
  'Maluku Utara': 31,
  'Papua Barat': 32,
  'Papua': 33
};

// Load data tourism dari CSV - DISESUAIKAN DENGAN HEADER BARU
const loadTourismData = async () => {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'wisata_indonesia_final_fix.csv');
    
    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim()
      });
      
      // MAPPING SESUAI HEADER CSV BARU: kategori,nama_wisata,latitude,longitude,alamat,provinsi,kota_kabupaten,nama_lengkap,deskripsi_bersih,Image_Path
      tourismData = parsed.data.map((row, index) => ({
        id: index + 1,
        kategori: row.kategori || '',
        nama_wisata: row.nama_wisata || '',
        latitude: parseFloat(row.latitude) || 0,
        longitude: parseFloat(row.longitude) || 0,
        alamat: row.alamat || '',
        provinsi: row.provinsi || '',
        kota_kabupaten: row.kota_kabupaten || '',
        nama_lengkap: row.nama_lengkap || '',
        deskripsi_bersih: row.deskripsi_bersih || '',
        Image_Path: row.Image_Path || '',
        // Untuk backward compatibility dengan kode lama
        rating: 0, // Default rating karena tidak ada di CSV
        harga_tiket: 0, // Default harga karena tidak ada di CSV
        jam_buka: '', // Default jam buka karena tidak ada di CSV
        foto_url: row.Image_Path || '', // Mapping Image_Path ke foto_url untuk compatibility
        lat: parseFloat(row.latitude) || 0, // Mapping latitude ke lat untuk compatibility
        lng: parseFloat(row.longitude) || 0, // Mapping longitude ke lng untuk compatibility
        deskripsi: row.deskripsi_bersih || '', // Mapping deskripsi_bersih ke deskripsi untuk compatibility
        name: row.nama_wisata || '', // Mapping nama_wisata ke name untuk compatibility
        category: row.kategori || '', // Mapping kategori ke category untuk compatibility
        province: row.provinsi || '', // Mapping provinsi ke province untuk compatibility
        address: row.alamat || '', // Mapping alamat ke address untuk compatibility
        image_url: row.Image_Path || '' // Mapping Image_Path ke image_url untuk compatibility
      }));
      
      console.log(`Tourism data loaded: ${tourismData.length} places`);
      console.log('Sample data structure:', tourismData[0]);
    } else {
      console.warn('Tourism CSV file not found, using sample data');
      tourismData = getSampleTourismData();
    }
  } catch (error) {
    console.error('Error loading tourism CSV:', error);
    tourismData = getSampleTourismData();
  }
};

// Sample data dengan struktur header baru jika CSV tidak ada
const getSampleTourismData = () => {
  return [
    {
      id: 1,
      kategori: "Bahari",
      nama_wisata: "Pantai Kuta",
      latitude: -8.7184,
      longitude: 115.1686,
      alamat: "Kuta, Badung, Bali",
      provinsi: "Bali",
      kota_kabupaten: "Badung",
      nama_lengkap: "Pantai Kuta Bali",
      deskripsi_bersih: "Pantai terkenal di Bali dengan sunset yang indah",
      Image_Path: "",
      // Backward compatibility
      rating: 4.5,
      harga_tiket: 0,
      jam_buka: "24 jam",
      foto_url: "",
      lat: -8.7184,
      lng: 115.1686,
      deskripsi: "Pantai terkenal di Bali dengan sunset yang indah",
      name: "Pantai Kuta",
      category: "Bahari",
      province: "Bali",
      address: "Kuta, Badung, Bali",
      image_url: ""
    },
    {
      id: 2,
      kategori: "Budaya",
      nama_wisata: "Candi Borobudur",
      latitude: -7.6079,
      longitude: 110.2038,
      alamat: "Magelang, Jawa Tengah",
      provinsi: "Jawa Tengah",
      kota_kabupaten: "Magelang",
      nama_lengkap: "Candi Borobudur Magelang",
      deskripsi_bersih: "Candi Buddha terbesar di dunia",
      Image_Path: "",
      // Backward compatibility
      rating: 4.8,
      harga_tiket: 50000,
      jam_buka: "06:00-17:00",
      foto_url: "",
      lat: -7.6079,
      lng: 110.2038,
      deskripsi: "Candi Buddha terbesar di dunia",
      name: "Candi Borobudur",
      category: "Budaya",
      province: "Jawa Tengah",
      address: "Magelang, Jawa Tengah",
      image_url: ""
    },
    {
      id: 3,
      kategori: "Cagar Alam",
      nama_wisata: "Taman Nasional Komodo",
      latitude: -8.5479,
      longitude: 119.4853,
      alamat: "Flores, NTT",
      provinsi: "Nusa Tenggara Timur",
      kota_kabupaten: "Flores",
      nama_lengkap: "Taman Nasional Komodo Flores",
      deskripsi_bersih: "Habitat asli komodo dan keindahan alam",
      Image_Path: "",
      // Backward compatibility
      rating: 4.7,
      harga_tiket: 150000,
      jam_buka: "07:00-18:00",
      foto_url: "",
      lat: -8.5479,
      lng: 119.4853,
      deskripsi: "Habitat asli komodo dan keindahan alam",
      name: "Taman Nasional Komodo",
      category: "Cagar Alam",
      province: "Nusa Tenggara Timur",
      address: "Flores, NTT",
      image_url: ""
    }
  ];
};

// Fungsi untuk preprocessing dengan hash encoding (fallback)
const preprocessInput = (provinsi, kategori) => {
  const encode = (val) => {
    let hash = 0;
    for (let i = 0; i < val.length; i++) {
      hash = val.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash % 1000)) / 1000;
  };

  const provinsiEncoded = encode(provinsi || 'unknown');
  const kategoriEncoded = encode(kategori || 'general');

  return [provinsiEncoded, kategoriEncoded, 0, 0];
};

const loadWeights = async () => {
  try {
    const weightsPath = path.join(process.cwd(), 'public', 'model', 'group1-shard1of1.bin');
    return await fs.promises.readFile(weightsPath);
  } catch (error) {
    console.warn('Could not load weights file:', error);
    return null;
  }
};

// Tambahkan error handling di loadModel
const loadModel = async () => {
  try {
    if (isInitialized) return;
    
    await loadTourismData();
    
    // Coba load model dari file
    try {
      const modelPath = path.join(process.cwd(), 'public', 'model', 'model_corrected.json');
      model = await tf.loadLayersModel(`file://${modelPath}`);
      console.log('Model loaded from file successfully');
    } catch (fileError) {
      console.warn('Failed to load model from file, creating fallback model:', fileError);
      await createFallbackModel();
    }
    
    isInitialized = true;
  } catch (error) {
    console.error('Model initialization failed:', error);
    throw error;
  }
};

const createFallbackModel = async () => {
  try {
    model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [4], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    console.log('Fallback ML model created successfully');
  } catch (error) {
    console.error('Error creating fallback model:', error);
    throw error;
  }
};

const predict = async (kategori, provinsi) => {
  if (!isInitialized || !model) {
    throw new Error('Model not loaded or initialized');
  }

  try {
    let inputData;
    
    // Coba gunakan mapping numerik terlebih dahulu
    const kategoriNum = KATEGORI_MAPPING[kategori];
    const provinsiNum = PROVINSI_MAPPING[provinsi];
    
    if (kategoriNum !== undefined && provinsiNum !== undefined) {
      // Gunakan mapping numerik jika tersedia
      inputData = tf.tensor2d([[kategoriNum, provinsiNum, 0, 0]]);
    } else {
      // Gunakan preprocessing hash encoding sebagai fallback
      const features = preprocessInput(provinsi, kategori);
      inputData = tf.tensor2d([features]);
    }
    
    // Make prediction
    const prediction = model.predict(inputData);
    const result = await prediction.data();
    
    // Cleanup tensors
    inputData.dispose();
    prediction.dispose();
    
    return result[0]; // Return prediction score
  } catch (error) {
    console.error('Prediction error:', error);
    throw error;
  }
};

// Fungsi untuk mendapatkan prediksi dengan format yang lebih detail
const getPredictionDetail = async (userId, kategori, provinsi) => {
  if (!isInitialized || !model) {
    throw new Error('Model not loaded or initialized');
  }

  try {
    const score = await predict(kategori, provinsi);
    
    return {
      userId,
      provinsi: provinsi.toLowerCase(),
      kategori: kategori.toLowerCase(),
      score: score,
      scorePercentage: Math.round(score * 100),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Detailed prediction error:', error);
    throw error;
  }
};

// Get tourism data yang sudah di-load
const getTourismData = () => {
  return tourismData;
};

// Filter tourism data berdasarkan kriteria - DISESUAIKAN DENGAN HEADER BARU
const filterTourismData = (kategori = null, provinsi = null) => {
  let filtered = [...tourismData];
  
  if (kategori) {
    filtered = filtered.filter(place => 
      place.kategori && place.kategori.toLowerCase() === kategori.toLowerCase()
    );
  }
  
  if (provinsi) {
    filtered = filtered.filter(place => 
      place.provinsi && place.provinsi.toLowerCase() === provinsi.toLowerCase()
    );
  }
  
  return filtered;
};

module.exports = { 
  loadModel, 
  predict, 
  getPredictionDetail,
  getTourismData,
  filterTourismData,
  loadTourismData,
  isInitialized: () => isInitialized,
  KATEGORI_MAPPING, 
  PROVINSI_MAPPING 
};