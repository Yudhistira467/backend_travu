// src/services/dataService.js
const csv = require('csv-parser');
const fs = require('fs');
const { getFirestore } = require('../config/firebase');

const importTourismData = async (csvFilePath) => {
  const db = getFirestore();
  const batch = db.batch();
  let count = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const docRef = db.collection('tourism_places').doc();
        batch.set(docRef, {
          kategori: row.kategori,
          nama_wisata: row.nama_wisata,
          latitude: parseFloat(row.latitude) || 0,
          longitude: parseFloat(row.longitude) || 0,
          alamat: row.alamat,
          provinsi: row.provinsi,
          kota_kabupaten: row.kota_kabupaten,
          nama_lengkap: row.nama_lengkap,
          deskripsi_bersih: row.deskripsi_bersih,
          image_path: row.Image_Path,
          createdAt: new Date()
        });
        
        count++;
        
        // Commit batch every 500 documents
        if (count % 500 === 0) {
          batch.commit().then(() => {
            console.log(`Imported ${count} records`);
          });
        }
      })
      .on('end', async () => {
        if (count % 500 !== 0) {
          await batch.commit();
        }
        console.log(`Tourism data import completed. Total: ${count} records`);
        resolve(count);
      })
      .on('error', (error) => {
        console.error('CSV import error:', error);
        reject(error);
      });
  });
};

module.exports = { importTourismData };