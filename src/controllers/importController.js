const pool = require('../config/db');

// School coordinates
const SCHOOL_LAT = -0.088794;
const SCHOOL_LNG = 37.989700;

async function fetchOverpass(query) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} - ${text.substring(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Overpass: ${text.substring(0, 200)}`);
  }
}

async function importFromOpenStreetMap(req, res) {
  try {
    const radiusMeters = 10000;

    const query = `[out:json][timeout:30];
(
  node["tourism"="hostel"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
  node["tourism"="guest_house"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
  node["tourism"="hotel"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
  node["building"="dormitory"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
);
out body;`;

    const data = await fetchOverpass(query);
    const elements = data.elements || [];

    if (elements.length === 0) {
      return res.json({
        message: 'No hostels found on OpenStreetMap near your school location.',
        imported: 0,
        tip: 'Your area may not have many mapped hostels on OpenStreetMap yet.',
      });
    }

    let imported = 0;
    let skipped = 0;

    for (const el of elements) {
      const lat = el.lat;
      const lng = el.lon;
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || 'Unnamed Hostel';
      const address = [
        tags['addr:street'],
        tags['addr:city'],
        tags['addr:suburb'],
        tags['addr:town'],
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
    console.error('OSM Import Error:', err.message);
    res.status(500).json({
      error: 'Failed to import from OpenStreetMap',
      details: err.message,
    });
  }
}

module.exports = { importFromOpenStreetMap };