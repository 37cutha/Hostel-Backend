const pool = require('../config/db');

async function addReview(req, res) {
  const { hostelId } = req.params;
  const { rating, comment } = req.body;
  if (!rating) return res.status(400).json({ error: 'rating is required' });
  try {
    const result = await pool.query(
      `INSERT INTO reviews (hostel_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [hostelId, req.user.id, rating, comment]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add review' });
  }
}

async function toggleFavorite(req, res) {
  const { hostelId } = req.params;
  try {
    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND hostel_id = $2',
      [req.user.id, hostelId]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE id = $1', [existing.rows[0].id]);
      return res.json({ favorited: false });
    }
    await pool.query('INSERT INTO favorites (user_id, hostel_id) VALUES ($1, $2)', [req.user.id, hostelId]);
    res.json({ favorited: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
}

async function getFavorites(req, res) {
  try {
    const result = await pool.query(
      `SELECT h.* FROM favorites f
       JOIN hostels h ON h.id = f.hostel_id
       WHERE f.user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
}

module.exports = { addReview, toggleFavorite, getFavorites };
