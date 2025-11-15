const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;
const SECRET = 'your_secret_key';

app.use(bodyParser.json());
app.use(express.static('public'));

// 🔐 Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    const user = { email };
    const token = jwt.sign(user, SECRET);
    res.json({ token });
  } else {
    res.status(400).json({ error: 'Email and password required' });
  }
});

// 🛡️ Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// 🎨 Serve login page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// 🎶 Playlist route
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

// 🚀 Start server
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});
const usersFile = path.join(__dirname, 'data', 'users.json');
let users = JSON.parse(fs.readFileSync(usersFile, 'utf8') || '{}');
app.post('/signup', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' });
  }

  users.push({ email, password });
  const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});
app.get('/api/playlist', verifyToken, (req, res) => {
  const userDir = path.join(__dirname, 'public', 'users', req.user.email);
  if (!fs.existsSync(userDir)) {
    return res.json({ email: req.user.email, songs: [] });
  }

  const songs = fs.readdirSync(userDir).filter(file => file.endsWith('.mp3'));
  res.json({ email: req.user.email, songs });
});const favFile = path.join(__dirname, 'data', 'favorites.json');
let userFavorites = JSON.parse(fs.readFileSync(favFile, 'utf8') || '{}');
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