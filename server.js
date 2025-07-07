const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'mysecret';

app.use(cors());
app.use(express.json());

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// MongoDB setup
mongoose.connect('mongodb://localhost:27017/timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const TimetableSchema = new mongoose.Schema({
  userId: String,
  teacher: String,
  subject: String,
  division: String,
  startTime: String,
  endTime: String,
  day: String,
});

const User = mongoose.model('User', UserSchema);
const Timetable = mongoose.model('Timetable', TimetableSchema);

// Auth routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.send('OK');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).send('User not found');
  if (await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token });
  } else {
    res.status(400).send('Wrong password');
  }
});

// Middleware to protect routes
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// CRUD for timetable
app.post('/timetable', auth, async (req, res) => {
  const { teacher, subject, division, startTime, endTime, day } = req.body;

  const conflict = await Timetable.findOne({
    division, day,
    $or: [
      { startTime: { $lt: endTime, $gte: startTime } },
      { endTime: { $gt: startTime, $lte: endTime } }
    ]
  });

  if (conflict) return res.status(400).send('Time conflict!');

  await Timetable.create({ userId: req.user.id, teacher, subject, division, startTime, endTime, day });
  res.send('Added');
});

app.get('/timetable', auth, async (req, res) => {
  const entries = await Timetable.find({ userId: req.user.id });
  res.json(entries);
});

app.delete('/timetable/:id', auth, async (req, res) => {
  await Timetable.findByIdAndDelete(req.params.id);
  res.send('Deleted');
});

app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});
