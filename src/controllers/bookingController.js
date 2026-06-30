const pool = require('../config/db');

// Student creates a booking/inquiry for a hostel
async function createBooking(req, res) {
  const { hostelId } = req.params;
  const { message } = req.body;

  try {
    const userResult = await pool.query('SELECT name, phone FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const student = userResult.rows[0];

    const result = await pool.query(
      `INSERT INTO bookings (hostel_id, student_id, student_name, student_phone, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [hostelId, req.user.id, student.name, student.phone, message || 'I am interested in this hostel.']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
}

// Owner views bookings for their hostels
async function getOwnerBookings(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.*, h.name AS hostel_name
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       WHERE h.owner_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

// Student views their own bookings
async function getMyBookings(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.*, h.name AS hostel_name, h.address, h.price, h.billing_period
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       WHERE b.student_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your bookings' });
  }
}

// Owner updates booking status (accept/reject)
async function updateBookingStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const owns = await pool.query(
      `SELECT b.id FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       WHERE b.id = $1 AND h.owner_id = $2`,
      [id, req.user.id]
    );
    if (owns.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
}

module.exports = { createBooking, getOwnerBookings, getMyBookings, updateBookingStatus };