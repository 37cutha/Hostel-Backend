# HostelFinder Backend

Express + PostgreSQL API for the HostelFinder app.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a PostgreSQL database:
   ```
   createdb hostelfinder
   ```

3. Copy `.env.example` to `.env` and fill in your DB credentials and a JWT secret:
   ```
   cp .env.example .env
   ```

4. Run the schema to create tables:
   ```
   psql -U postgres -d hostelfinder -f src/config/schema.sql
   ```

5. Start the server:
   ```
   npm run dev
   ```
   API runs at `http://localhost:5000`.

## Endpoints

### Auth
- `POST /api/auth/register` — body: `{ name, email, phone, password, role }` (role: "student" or "owner")
- `POST /api/auth/login` — body: `{ email, password }`
  Both return `{ user, token }`. Send `token` as `Authorization: Bearer <token>` on protected routes.

### Hostels
- `GET /api/hostels/nearby?lat=&lng=&radius=5&max_price=&room_type=` — public, returns hostels sorted by distance
- `GET /api/hostels/:id` — public, single hostel with photos and reviews
- `POST /api/hostels` — owner only, multipart form with fields + up to 10 `photos` files
- `GET /api/hostels/mine/list` — owner only, list your own hostels
- `PUT /api/hostels/:id` — owner only
- `DELETE /api/hostels/:id` — owner only

### Reviews & Favorites
- `POST /api/hostels/:hostelId/reviews` — body: `{ rating, comment }`
- `POST /api/hostels/:hostelId/favorite` — toggles favorite
- `GET /api/favorites` — your saved hostels

## Notes
- Distance search uses the Haversine formula directly in SQL (`getNearbyHostels`), no extra extensions needed.
- Uploaded photos are served statically from `/uploads/<filename>`.
- In Flutter, call `nearby` with the device's GPS coordinates (via the `geolocator` package), then use the returned `latitude`/`longitude` per hostel to launch turn-by-turn navigation (e.g. open Google Maps with `google.navigation:q=lat,lng` or use `google_maps_flutter` + `flutter_polyline_points`).
