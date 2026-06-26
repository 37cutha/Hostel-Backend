const pool = require('../config/db');

const SCHOOL_LAT = -0.088794;
const SCHOOL_LNG = 37.989700;

// Try multiple Overpass servers in case one is busy
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchOverpass(query) {
  const fetch = (await import('node-fetch')).default;

  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(`Trying Overpass server: ${server}`);
      const response = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        timeout: 25000,
      });

      if (!response.ok) {
        console.log(`Server ${server} returned ${response.status}, trying next...`);
        continue;
      }

      const text = await response.text();
      return JSON.parse(text);
    } catch (err) {
      console.log(`Server ${server} failed: ${err.message}, trying next...`);
      continue;
    }
  }

  throw new Error('All Overpass servers failed or timed out. Try again later.');
}

async function importFromOpenStreetMap(req, res) {
  try {
    const radiusMeters = 5000; // reduced to 5km for faster query

    // Simplified query — just nodes, no ways, shorter timeout
    const query = `[out:json][timeout:20];
(
  node["tourism"~"hostel|guest_house|hotel"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
  node["building"="dormitory"](around:${radiusMeters},${SCHOOL_LAT},${SCHOOL_LNG});
);
out body;`;

    const data = await fetchOverpass(query);
    const elements = data.elements || [];

    if (elements.length === 0) {
      return res.json({
        message: 'No hostels found on OpenStreetMap near your school. Your area may not be well mapped yet.',
        imported: 0,
        suggestion: 'You can add hostels manually through the app instead.',
      });
    }

    let imported = 0;
    let skipped = 0;

    for (const el of elements) {
      const lat = el.lat;
      const lng = el.lon;
      const tags = el.tags || {};
      const name = tags.name || 'Unnamed Hostel';
      const address = [
        tags['addr:street'],
        tags['addr:city'],
        tags['addr:suburb'],
        tags['addr:town'],
      ].filter(Boolean).join(', ') || null;

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
        `INSERT INTO hostels (name, address, latitude, longitude, description, amenities, billing_period)
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
