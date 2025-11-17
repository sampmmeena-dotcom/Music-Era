const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;
const SECRET = 'your_secret_key';

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Load users
const usersPath = path.join(__dirname, 'data', 'users.json');
let users = {};
try {
  const rawData = fs.readFileSync(usersPath, 'utf-8');
  users = JSON.parse(rawData);
} catch (err) {
  console.error('Error reading users.json:', err.message);
}

// Load favorites
const favoritesPath = path.join(__dirname, 'data', 'favorites.json');
let favorites = {};

if (!fs.existsSync(favoritesPath)) {
  fs.writeFileSync(favoritesPath, JSON.stringify({}));
  console.log('✅ Created missing favorites.json');
}

favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
// 🔐 Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email);

  if (!users[email]) {
    console.log('❌ Email not found');
    return res.status(401).json({ error: 'Login failed' });
  }

  if (users[email].password !== password) {
    console.log('❌ Incorrect password');
    return res.status(401).json({ error: 'Login failed' });
  }

  const token = jwt.sign({ email }, SECRET, { expiresIn: '1h' });
  console.log('✅ Login success');
  res.json({ token });
});

// 🆕 Signup route
app.post('/signup', (req, res) => {
  const { email, password } = req.body;

  if (users[email]) {
    return res.status(400).send('User already exists');
  }

  users[email] = { password, favorites: [] };
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.send('Signup successful');
});

// 🛡️ Token middleware
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    next();
  });
}

// 🎨 Login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 🎶 Playlist page
app.get('/playlist', verifyToken, (req, res) => {
  const songs = fs.readdirSync('./public').filter(file => file.endsWith('.mp3'));
  const list = songs.map(song => `<li><a href="/play?song=${encodeURIComponent(song)}&token=${req.query.token}">${song}</a></li>`).join('');
  res.send(`
    <html>
      <head><link rel="stylesheet" href="/style.css"></head>
      <body>
        <h2>Welcome ${req.user.email} 🎶</h2>
        <h3>Your Playlist:</h3>
        <ul>${list}</ul>
        <h3>Upload a new song:</h3>
        <form action="/upload?token=${req.query.token}" method="POST" enctype="multipart/form-data">
          <input type="file" name="song" accept=".mp3" required>
          <button type="submit">Upload</button>
        </form>
      </body>
    </html>
  `);
});

// ▶️ Play song
app.get('/play', verifyToken, (req, res) => {
  const song = req.query.song || 'song1.mp3';
  res.send(`
    <html>
      <head><link rel="stylesheet" href="/style.css"></head>
      <body>
        <h2>Now Playing for ${req.user.email} 🎶</h2>
        <audio controls autoplay>
          <source src="/${song}" type="audio/mpeg">
        </audio>
        <br><a href="/playlist?token=${req.query.token}">Back to Playlist</a>
      </body>
    </html>
  `);
});

// 📤 Upload song
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, 'public', 'users', req.user.email);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== '.mp3') {
      return cb(new Error('Only .mp3 files allowed'));
    }
    cb(null, true);
  }
});

app.post('/upload', verifyToken, upload.single('song'), (req, res) => {
  res.redirect(`/playlist?token=${req.query.token}`);
});

// 🎯 Get user playlist
app.get('/api/playlists', verifyToken, (req, res) => {
  const email = req.user.email;
  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};

  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }

  res.json(playlists[email] || {});
});
const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
if (!fs.existsSync(playlistsPath)) {
  fs.writeFileSync(playlistsPath, JSON.stringify({}));
  console.log('✅ Created missing playlists.json');
}

// ❤️ Favorite songs
app.post('/api/favorite', verifyToken, (req, res) => {
  const { song } = req.body;
  const email = req.user.email;
  if (!song) return res.status(400).json({ error: 'No song provided' });

  if (!userFavorites[email]) userFavorites[email] = [];
  if (!userFavorites[email].includes(song)) {
    userFavorites[email].push(song);
    fs.writeFileSync(favFile, JSON.stringify(userFavorites, null, 2));
  }

  res.json({ success: true });
});

app.get('/api/favorite', verifyToken, (req, res) => {
  const email = req.user.email;
  const favorites = userFavorites[email] || [];
  res.json({ favorites });
});

// 🧹 404 fallback
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// 🚀 Start server

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get('/api/playlists', verifyToken, (req, res) => {
  const email = req.user.email;
  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};
  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }
  res.json({ playlists: playlists[email] || {} });
});
app.post('/api/playlists', verifyToken, (req, res) => {
  const { playlistName, song } = req.body;
  const email = req.user.email;
  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};
  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }
  if (!playlists[email]) playlists[email] = {};
  if (!playlists[email][playlistName]) playlists[email][playlistName] = [];
  if (!playlists[email][playlistName].includes(song)) {
    playlists[email][playlistName].push(song);
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  }
  res.json({ success: true });
});
app.post('/api/playlists/remove', verifyToken, (req, res) => {
  const { playlistName, song } = req.body;
  const email = req.user.email;
  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};
  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }
  if (playlists[email] && playlists[email][playlistName]) {
    playlists[email][playlistName] = playlists[email][playlistName].filter(s => s !== song);
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  }
  res.json({ success: true });
});
app.post('/api/playlists/delete', verifyToken, (req, res) => {
  const { playlistName } = req.body;
  const email = req.user.email;
  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};
  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }
  if (playlists[email]) {
    delete playlists[email][playlistName];
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  }
  res.json({ success: true });
});
app.get('/api/public-playlist', (req, res) => {
  const { user, playlist } = req.query;
  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};
  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }
  const songs = playlists[user]?.[playlist] || [];
  res.json({ songs });
});
const coverUpload = multer({ dest: 'public/covers/' });

app.post('/api/playlist-cover', verifyToken, coverUpload.single('cover'), (req, res) => {
  const email = req.user.email;
  const playlistName = req.body.playlistName;
  const filename = req.file.filename;

  const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
  let playlists = {};
  if (fs.existsSync(playlistsPath)) {
    playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
  }
  
  if (!playlists[email]) playlists[email] = {};
  if (!playlists[email][playlistName]) playlists[email][playlistName] = { songs: [] };
  playlists[email][playlistName].cover = filename;

  fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
  res.json({ success: true });
});