const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const SECRET = 'music-era-secret';
const usersPath = path.join(__dirname, 'data', 'users.json');
const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
const favoritesPath = path.join(__dirname, 'data', 'favorites.json');

// 🛡️ Fallback for missing files
if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, JSON.stringify({}));
if (!fs.existsSync(playlistsPath)) fs.writeFileSync(playlistsPath, JSON.stringify({}));
if (!fs.existsSync(favoritesPath)) fs.writeFileSync(favoritesPath, JSON.stringify({}));

// 🔐 Auth middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// 🧑‍💻 Login
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  if (!users[email]) users[email] = { email };
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  const token = jwt.sign({ email }, SECRET);
  res.json({ token });
});

// 👤 Profile
app.get('/api/profile', verifyToken, (req, res) => {
  res.json({ email: req.user.email });
});

// 🎵 Upload song
const upload = multer({ dest: 'public/songs/' });
app.post('/api/upload', verifyToken, upload.single('song'), (req, res) => {
  const file = req.file;
  const ext = path.extname(file.originalname);
  const newPath = path.join(file.destination, file.originalname);
  fs.renameSync(file.path, newPath);
  res.json({ success: true });
});

// 📂 Get playlists
app.get('/api/playlists', verifyToken, (req, res) => {
  const email = req.user.email;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  res.json(playlists[email] || {});
});

// ➕ Add to playlist
app.post('/api/add-to-playlist', verifyToken, (req, res) => {
  const { name, song } = req.body;
  const email = req.user.email;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  if (!playlists[email]) playlists[email] = {};
  if (!playlists[email][name]) playlists[email][name] = { songs: [] };
  if (!playlists[email][name].songs.includes(song)) {
    playlists[email][name].songs.push(song);
  }
  fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  res.json({ success: true });
});

// 🗑️ Remove from playlist
app.post('/api/remove-from-playlist', verifyToken, (req, res) => {
  const { name, song } = req.body;
  const email = req.user.email;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  if (playlists[email] && playlists[email][name]) {
    playlists[email][name].songs = playlists[email][name].songs.filter(s => s !== song);
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  }
  res.json({ success: true });
});

// ❌ Delete playlist
app.post('/api/delete-playlist', verifyToken, (req, res) => {
  const { name } = req.body;
  const email = req.user.email;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  if (playlists[email]) {
    delete playlists[email][name];
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  }
  res.json({ success: true });
});

// ❤️ Toggle favorite
app.post('/api/favorites', verifyToken, (req, res) => {
  const { song } = req.body;
  const email = req.user.email;
  const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
  if (!favorites[email]) favorites[email] = [];
  const index = favorites[email].indexOf(song);
  if (index === -1) {
    favorites[email].push(song);
  } else {
    favorites[email].splice(index, 1);
  }
  fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
  res.json({ success: true });
});

// 📤 Share playlist (public)
app.get('/api/public-playlist/:email/:name', (req, res) => {
  const { email, name } = req.params;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  const playlist = playlists[email]?.[name];
  if (playlist) {
    res.json({ name, songs: playlist.songs });
  } else {
    res.status(404).json({ error: 'Playlist not found' });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});