const pool = require('../config/db');

// Fixed reference point: school location (Marimanti)
const SCHOOL_LAT = -0.088794;
const SCHOOL_LNG = 37.989700;

// Haversine formula distance in km, computed in SQL for "nearby" search
const DISTANCE_SQL = `
  (6371 * acos(
    cos(radians($1)) * cos(radians(latitude)) *
    cos(radians(longitude) - radians($2)) +
    sin(radians($1)) * sin(radians(latitude))
  ))
`;

// Distance from the fixed school location specifically (no params needed, school coords are constants)
const DISTANCE_FROM_SCHOOL_SQL = `
  (6371 * acos(
    cos(radians(${SCHOOL_LAT})) * cos(radians(latitude)) *
    cos(radians(longitude) - radians(${SCHOOL_LNG})) +
    sin(radians(${SCHOOL_LAT})) * sin(radians(latitude))
  ))
`;

async function createHostel(req, res) {
  const { name, description, address, latitude, longitude, price, billing_period, room_type, amenities, caretaker_name, caretaker_phone } = req.body;
  if (!name || !latitude || !longitude) {
    return res.status(400).json({ error: 'name, latitude, and longitude are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO hostels (owner_id, name, description, address, latitude, longitude, price, billing_period, room_type, amenities, caretaker_name, caretaker_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *, ${DISTANCE_FROM_SCHOOL_SQL} AS distance_from_school_km`,
      [req.user.id, name, description, address, latitude, longitude, price, billing_period || 'monthly', room_type, amenities || [], caretaker_name, caretaker_phone]
    );

    const hostel = result.rows[0];

    // Attach uploaded photos, if any
    if (req.files && req.files.length > 0) {
      const photoInserts = req.files.map((f) =>
        pool.query(
          'INSERT INTO hostel_photos (hostel_id, photo_url) VALUES ($1, $2)',
          [hostel.id, `/uploads/${f.filename}`]
        )
      );
      await Promise.all(photoInserts);
    }

    res.status(201).json(hostel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create hostel' });
  }
}

async function getNearbyHostels(req, res) {
  const { lat, lng, radius = 5, max_price, room_type } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }
  try {
    let query = `
      SELECT h.*, ${DISTANCE_SQL} AS distance_km,
        ${DISTANCE_FROM_SCHOOL_SQL} AS distance_from_school_km,
        COALESCE(array_agg(p.photo_url) FILTER (WHERE p.photo_url IS NOT NULL), '{}') AS photos
      FROM hostels h
      LEFT JOIN hostel_photos p ON p.hostel_id = h.id
      WHERE 1=1
    `;
    const params = [lat, lng];
    let idx = 3;

    if (max_price) {
      query += ` AND h.price <= $${idx}`;
      params.push(max_price);
      idx++;
    }
    if (room_type) {
      query += ` AND h.room_type = $${idx}`;
      params.push(room_type);
      idx++;
    }

    query += ` GROUP BY h.id HAVING ${DISTANCE_SQL} <= $${idx} ORDER BY distance_km ASC`;
    params.push(radius);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hostels' });
  }
}

async function getHostelById(req, res) {
  const { id } = req.params;
  try {
    const hostelResult = await pool.query(
      `SELECT *, ${DISTANCE_FROM_SCHOOL_SQL} AS distance_from_school_km FROM hostels WHERE id = $1`,
      [id]
    );
    if (hostelResult.rows.length === 0) return res.status(404).json({ error: 'Hostel not found' });

    const photosResult = await pool.query('SELECT photo_url FROM hostel_photos WHERE hostel_id = $1', [id]);
    const reviewsResult = await pool.query(
      `SELECT r.rating, r.comment, r.created_at, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.hostel_id = $1 ORDER BY r.created_at DESC`,
      [id]
    );

    res.json({
      ...hostelResult.rows[0],
      photos: photosResult.rows.map((r) => r.photo_url),
      reviews: reviewsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hostel' });
  }
}

async function updateHostel(req, res) {
  const { id } = req.params;
  const fields = ['name', 'description', 'address', 'latitude', 'longitude', 'price', 'billing_period', 'room_type', 'amenities', 'caretaker_name', 'caretaker_phone'];
  const updates = [];
  const values = [];
  let idx = 1;

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${idx}`);
      values.push(req.body[field]);
      idx++;
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const owns = await pool.query('SELECT owner_id FROM hostels WHERE id = $1', [id]);
    if (owns.rows.length === 0) return res.status(404).json({ error: 'Hostel not found' });
    if (owns.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

    updates.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE hostels SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update hostel' });
  }
}

async function deleteHostel(req, res) {
  const { id } = req.params;
  try {
    const owns = await pool.query('SELECT owner_id FROM hostels WHERE id = $1', [id]);
    if (owns.rows.length === 0) return res.status(404).json({ error: 'Hostel not found' });
    if (owns.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

    await pool.query('DELETE FROM hostels WHERE id = $1', [id]);
    res.json({ message: 'Hostel deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete hostel' });
  }
}

async function getMyHostels(req, res) {
  try {
    const result = await pool.query('SELECT * FROM hostels WHERE owner_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your hostels' });
  }
}

module.exports = {
  createHostel,
  getNearbyHostels,
  getHostelById,
  updateHostel,
  deleteHostel,
  getMyHostels,
};