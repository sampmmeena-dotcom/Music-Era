const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const SECRET = 'your_secret_key';

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Load users
const usersPath = path.join(__dirname, 'data', 'users.json');
let users = [];
try {
  const rawData = fs.readFileSync(usersPath, 'utf-8');
  users = JSON.parse(rawData);
} catch (err) {
  console.error('Error reading users.json:', err.message);
}

// Load favorites
const favFile = path.join(__dirname, 'data', 'favorites.json');
let userFavorites = {};
try {
  userFavorites = JSON.parse(fs.readFileSync(favFile, 'utf8') || '{}');
} catch (err) {
  console.error('Error reading favorites.json:', err.message);
}

// 🔐 Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email, password);

  const usersPath = path.join(__dirname, 'data', 'users.json');
  if (!fs.existsSync(usersPath)) {
    console.error('❌ users.json not found');
    return res.status(500).json({ error: 'User data missing' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  console.log('Loaded users:', users);
  console.log('Login attempt:', email, password);
console.log('Loaded users:', users);
console.log('User match:', users[email]);

  if (users[email] && users[email].password === password) {
    console.log('✅ Login success');
    res.json({ token: 'dummy-token' });
  } else {
    console.log('❌ Login failed');
    res.status(401).json({ error: 'Login failed' });
  }
});

// 🆕 Signup route
app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const usersPath = path.join(__dirname, 'data', 'users.json');

  let users = {};
  if (fs.existsSync(usersPath)) {
    users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  }

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
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// 🎨 Login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
const res = await fetch('https://music-env.bxvv.onrender.com/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
if (res.ok) {
  const data = await res.json(); // ✅ Parse JSON
  localStorage.setItem('token', data.token);
  window.location.href = '/playlist.html';
} else {
  const error = await res.json();
  alert(error.error); // Shows "Login failed"
}

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
app.get('/api/playlist', verifyToken, (req, res) => {
  const userDir = path.join(__dirname, 'public', 'users', req.user.email);
  if (!fs.existsSync(userDir)) return res.json({ email: req.user.email, songs: [] });

  const songs = fs.readdirSync(userDir).filter(file => file.endsWith('.mp3'));
  res.json({ email: req.user.email, songs });
});

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
  console.log(`✅ Server running on port ${PORT}`);
});
async function loadData() {
 app.post('/login', async (req, res) => {
   const { email, password } = req.body;

   try {
     const response = await fetch('https://music-env.bxvv.onrender.com/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password })
     });

     const data = await response.json();
     res.json(data);
   } catch (error) {
     console.error('❌ Error during fetch:', error);
     res.status(500).json({ error: 'Login request failed' });
   }
 });
}