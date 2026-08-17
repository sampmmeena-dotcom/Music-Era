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
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const usersPath = path.join(__dirname, 'data', 'users.json');
const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
const favoritesPath = path.join(__dirname, 'data', 'favorites.json');
const recentPath = path.join(__dirname, 'data', 'recent.json');
if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, JSON.stringify({}));
if (!fs.existsSync(playlistsPath)) fs.writeFileSync(playlistsPath, JSON.stringify({}));
if (!fs.existsSync(favoritesPath)) fs.writeFileSync(favoritesPath, JSON.stringify({}));
if (!fs.existsSync(recentPath)) fs.writeFileSync(recentPath, JSON.stringify({}));

function verifyToken(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    const token = auth.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  if (!users[email]) {
    users[email] = { email, password };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  }
  if (users[email].password !== password) {
    return res.status(403).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ email }, SECRET);
  res.json({ token });
});

app.get('/api/profile', verifyToken, (req, res) => {
  res.json({ email: req.user.email });
});

const upload = multer({ dest: 'public/songs/' });
app.post('/api/upload', verifyToken, upload.single('song'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const sanitized = path.basename(file.originalname);
  const newPath = path.join(file.destination, sanitized);
  try {
    fs.renameSync(file.path, newPath);
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Could not save file' });
  }
  // public/ is served as the static root, so songs are available at /songs/<name>
  const songUrl = '/songs/' + encodeURIComponent(sanitized);
  res.json({ success: true, songUrl });
});

app.get('/api/playlists', verifyToken, (req, res) => {
  const email = req.user.email;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  res.json(playlists[email] || {});
});

// New: return a single playlist (by ?name=) or the first playlist for the user
app.get('/api/playlist', verifyToken, (req, res) => {
  const name = req.query.name;
  const email = req.user.email;
  const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8')) || {};
  const userPlaylists = playlists[email] || {};
  let songs = [];
  let playlistName = name;
  if (name && userPlaylists[name]) {
    songs = userPlaylists[name].songs || [];
  } else {
    const keys = Object.keys(userPlaylists);
    if (keys.length > 0) {
      playlistName = keys[0];
      songs = userPlaylists[playlistName].songs || [];
    }
  }
  res.json({ songs, email, playlistName });
});

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

app.post('/api/recent', verifyToken, (req, res) => {
  const { song } = req.body;
  const email = req.user.email;
  const recent = JSON.parse(fs.readFileSync(recentPath, 'utf8'));

  if (!recent[email]) recent[email] = [];
  recent[email].unshift(song); // add to front
  recent[email] = [...new Set(recent[email])].slice(0, 10); // remove duplicates, keep last 10

  fs.writeFileSync(recentPath, JSON.stringify(recent, null, 2));
  res.json({ success: true });
});

app.get('/api/recent', verifyToken, (req, res) => {
  const email = req.user.email;
  const recent = JSON.parse(fs.readFileSync(recentPath, 'utf8'));
  res.json(recent[email] || []);
});

// Serve login page at root (login.html exists at repository root)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
