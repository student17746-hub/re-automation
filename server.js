require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store
global.leads = [];
global.io = io;

// Routes
app.use('/webhook', require('./routes/tally'));
app.use('/webhook', require('./routes/booking'));
app.use('/webhook', require('./routes/sms'));

// CRM API routes
app.use('/api', require('./routes/crm'));

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    total_leads: global.leads.length,
    version: '1.0.0'
  });
});

io.on('connection', (socket) => {
  console.log('Dashboard connected');
  socket.emit('init', { leads: global.leads });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Edmonton RE Automation Server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
