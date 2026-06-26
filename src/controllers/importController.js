const pool = require('../config/db');
const https = require('https');

// School coordinates
const SCHOOL_LAT = -0.088794;
const SCHOOL_LNG = 37.989700;

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function importFromOpenStreetMap(req, res) {
  try {
    const radiusMeters = 10000; // 10km radius around school

    const query = `
      [out:json][timeout:25];
      (
        node["tourism"="hostel"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
        node["tourism"="guest_house"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
        node["tourism"="hotel"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
        node["building"="dormitory"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
        way["tourism"="hostel"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
        way["tourism"="guest_house"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
      );
      out center;
    `;

    const data = await fetchOverpass(query);
    const elements = data.elements || [];

    if (elements.length === 0) {
      return res.json({
        message: 'No hostels found on OpenStreetMap near your school location',
        imported: 0,
      });
    }

    let imported = 0;
    let skipped = 0;

    for (const el of elements) {
      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || 'Unnamed Hostel';
      const address = [
        tags['addr:street'],
        tags['addr:city'],
        tags['addr:suburb'],
      ]
        .filter(Boolean)
        .join(', ') || null;

      if (!lat || !lng) continue;

      const existing = await pool.query(
        'SELECT id FROM hostels WHERE name = $1 AND latitude = $2 AND longitude = $3',
        [name, lat, lng]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO hostels 
          (name, address, latitude, longitude, description, amenities, billing_period)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          name,
          address,
          lat,
          lng,
          `Imported from OpenStreetMap. Type: ${tags.tourism || tags.building || 'hostel'}`,
          [],
          'monthly',
        ]
      );
      imported++;
    }

    res.json({
      message: `Import complete. ${imported} hostels added, ${skipped} already existed.`,
      imported,
      skipped,
      total: elements.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import from OpenStreetMap' });
  }
}

module.exports = { importFromOpenStreetMap };
