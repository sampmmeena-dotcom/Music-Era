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

// Use environment variable for secret
const SECRET = process.env.JWT_SECRET || 'music-era-secret-key-change-in-production';
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const usersPath = path.join(__dirname, 'data', 'users.json');
const playlistsPath = path.join(__dirname, 'data', 'playlists.json');
const favoritesPath = path.join(__dirname, 'data', 'favorites.json');
const recentPath = path.join(__dirname, 'data', 'recent.json');

// Initialize data files
const initFile = (filePath, defaultData = {}) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
};

initFile(usersPath, {});
initFile(playlistsPath, {});
initFile(favoritesPath, {});
initFile(recentPath, {});

function verifyToken(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token provided' });
    const token = auth.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Invalid token format' });
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// AUTHENTICATION
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    
    if (!users[email]) {
      users[email] = { email, password, createdAt: new Date().toISOString() };
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      return res.json({ token: jwt.sign({ email }, SECRET), isNewUser: true });
    }
    
    if (users[email].password !== password) {
      return res.status(403).json({ error: 'Incorrect password' });
    }
    
    const token = jwt.sign({ email }, SECRET);
    res.json({ token, isNewUser: false });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

app.post('/api/signup', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    
    if (users[email]) {
      return res.status(409).json({ error: 'User already exists' });
    }

    users[email] = { email, password, createdAt: new Date().toISOString() };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // Initialize user playlists
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
    playlists[email] = {};
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));

    const token = jwt.sign({ email }, SECRET);
    res.json({ token, message: 'Signup successful!' });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed: ' + err.message });
  }
});

app.get('/api/profile', verifyToken, (req, res) => {
  try {
    res.json({ email: req.user.email });
  } catch (err) {
    res.status(500).json({ error: 'Profile fetch failed' });
  }
});

// FILE UPLOAD
const songsDir = path.join(__dirname, 'public', 'songs');
if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });

const upload = multer({ 
  dest: songsDir,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files allowed.'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.post('/api/upload', verifyToken, upload.single('song'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const sanitized = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const ext = path.extname(sanitized) || '.mp3';
    const filename = `${Date.now()}-${sanitized}`.replace(/\s+/g, '_');
    const newPath = path.join(songsDir, filename);
    
    fs.renameSync(req.file.path, newPath);
    
    const songUrl = '/songs/' + filename;
    res.json({ success: true, songUrl, filename: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Upload failed: ' + err.message });
  }
});

// PLAYLIST MANAGEMENT
app.get('/api/playlists', verifyToken, (req, res) => {
  try {
    const email = req.user.email;
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
    res.json(playlists[email] || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

app.get('/api/playlist', verifyToken, (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

app.post('/api/create-playlist', verifyToken, (req, res) => {
  try {
    const { name } = req.body;
    const email = req.user.email;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Playlist name required' });
    }
    
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
    if (!playlists[email]) playlists[email] = {};
    
    if (playlists[email][name]) {
      return res.status(409).json({ error: 'Playlist already exists' });
    }
    
    playlists[email][name] = { songs: [], createdAt: new Date().toISOString() };
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
    res.json({ success: true, message: 'Playlist created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

app.post('/api/add-to-playlist', verifyToken, (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to add song' });
  }
});

app.post('/api/remove-from-playlist', verifyToken, (req, res) => {
  try {
    const { name, song } = req.body;
    const email = req.user.email;
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
    
    if (playlists[email] && playlists[email][name]) {
      playlists[email][name].songs = playlists[email][name].songs.filter(s => s !== song);
      fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2));
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

// FAVORITES
app.post('/api/favorites', verifyToken, (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to update favorites' });
  }
});

app.get('/api/favorites', verifyToken, (req, res) => {
  try {
    const email = req.user.email;
    const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
    res.json(favorites[email] || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// RECENT
app.post('/api/recent', verifyToken, (req, res) => {
  try {
    const { song } = req.body;
    const email = req.user.email;
    const recent = JSON.parse(fs.readFileSync(recentPath, 'utf8'));

    if (!recent[email]) recent[email] = [];
    recent[email].unshift(song);
    recent[email] = [...new Set(recent[email])].slice(0, 20);

    fs.writeFileSync(recentPath, JSON.stringify(recent, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update recent' });
  }
});

app.get('/api/recent', verifyToken, (req, res) => {
  try {
    const email = req.user.email;
    const recent = JSON.parse(fs.readFileSync(recentPath, 'utf8'));
    res.json(recent[email] || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent' });
  }
});

// PUBLIC PLAYLISTS (read-only)
app.get('/api/public-playlists', (req, res) => {
  try {
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
    const publicList = [];
    
    Object.entries(playlists).forEach(([email, userPlaylists]) => {
      Object.entries(userPlaylists).forEach(([name, data]) => {
        publicList.push({
          email,
          name,
          songCount: (data.songs || []).length,
          createdAt: data.createdAt
        });
      });
    });
    
    res.json(publicList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public playlists' });
  }
});

app.get('/api/public-playlist/:email/:name', (req, res) => {
  try {
    const { email, name } = req.params;
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf8'));
    
    if (playlists[email] && playlists[email][name]) {
      res.json({ songs: playlists[email][name].songs || [], email, playlistName: name });
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// ROOT
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/playlist.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'playlist.html'));
});

app.get('/explore', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'explore.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🎵 Music Era Server running on http://localhost:${PORT}`);
});
