import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);


// Session middleware
app.use(session({
  secret: 'seep-game-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.json());
app.use(express.static('dist'));

// In-memory storage
const users = {};
const games = {};

// API routes
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  const userId = uuidv4();
  users[userId] = { 
    id: userId, 
    username, 
    currentGame: null 
  };
  
  req.session.userId = userId;
  return res.json({ userId, username });
});

app.post('/api/games', (req, res) => {
  const userId = req.session.userId;
  
  if (!userId || !users[userId]) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const gameId = uuidv4();
  games[gameId] = {
    id: gameId,
    creator: userId,
    players: {
      plyr1: userId, // Creator automatically joins as plyr1
      plyr2: null,
      plyr3: null,
      plyr4: null
    },
    playerNames: {
      plyr1: users[userId].username, // Set creator's name
      plyr2: null,
      plyr3: null,
      plyr4: null
    },
    status: 'waiting',
    gameState: null
  };
  
  users[userId].currentGame = gameId;
  
  return res.json({ gameId });
});

app.get('/api/games', (req, res) => {
  const availableGames = Object.values(games)
    .filter(game => game.status === 'waiting')
    .map(game => ({
      id: game.id,
      creator: users[game.creator]?.username || 'Unknown',
      players: Object.values(game.playerNames).filter(Boolean).length,
      maxPlayers: 4
    }));
  
  return res.json(availableGames);
});

app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  if (!games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  return res.json(games[gameId]);
});

// Catch-all to serve the React app
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('authenticate', (userData) => {
    if (userData?.userId) {
      socket.userId = userData.userId;
      console.log(`Socket ${socket.id} authenticated as user ${userData.userId}`);
      
      // Ensure user exists
      if (!users[userData.userId]) {
        users[userData.userId] = { 
          id: userData.userId, 
          username: userData.username, 
          currentGame: null 
        };
      }
    }
  });
  
  socket.on('joinRoom', ({ gameId, userId }) => {
    console.log(`User ${userId} trying to join room ${gameId}`);
    
    if (games[gameId]) {
      socket.join(gameId);
      console.log(`Socket ${socket.id} (user: ${userId}) successfully joined room ${gameId}`);
      
      // Send current game state to the user who just joined the room
      socket.emit('gameUpdate', games[gameId]);
      console.log(`Sent game state to user ${userId}:`, games[gameId]);
    } else {
      console.log(`Game ${gameId} not found`);
    }
  });
  
  socket.on('joinGame', ({ userId, gameId, position }) => {
    console.log(`Join game: ${userId} -> ${gameId} at ${position}`);
    
    // Validate
    if (!users[userId] || !games[gameId]) {
      return socket.emit('error', 'Invalid user or game');
    }
    
    if (games[gameId].players[position]) {
      return socket.emit('error', 'Position already taken');
    }
    
    // Join the game
    games[gameId].players[position] = userId;
    games[gameId].playerNames[position] = users[userId].username;
    users[userId].currentGame = gameId;
    
    console.log(`${users[userId].username} joined ${gameId} at ${position}`);
    
    // Broadcast update to ALL players in the room (including the one who just joined)
    io.to(gameId).emit('gameUpdate', games[gameId]);
  });
  
  socket.on('startGame', ({ userId, gameId }) => {
    console.log(`Start game: ${userId} -> ${gameId}`);
    
    if (!users[userId] || !games[gameId]) {
      return socket.emit('error', 'Invalid user or game');
    }
    
    // Check if all positions filled
    const playerCount = Object.values(games[gameId].players).filter(Boolean).length;
    if (playerCount !== 4) {
      return socket.emit('error', 'Need 4 players to start');
    }
    
    // Start the game
    games[gameId].status = 'playing';
    
    // Initialize game state with plyr2 going first (opposite team of creator)
    games[gameId].gameState = {
      currentTurn: 'plyr2', // plyr2 starts (opposite team of plyr1 creator)
      moveCount: 0,
      dealVisible: true,
      collectedCards: { plyr1: [], plyr2: [], plyr3: [], plyr4: [] }
    };
    
    console.log(`Game ${gameId} started with plyr2 going first`);
    
    // Broadcast game start
    io.to(gameId).emit('gameStarted', games[gameId]);
  });
  
  socket.on('gameAction', ({ userId, gameId, action, data }) => {
    if (!users[userId] || !games[gameId]) {
      return socket.emit('error', 'Invalid user or game');
    }
    
    // Update game state
    if (action === 'updateGameState') {
      games[gameId].gameState = data;
    }
    
    // Broadcast to all players in the game
    socket.to(gameId).emit('gameAction', { 
      player: userId, 
      action, 
      data 
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database test failed:', err);
  } else {
    console.log('Database test successful:', res.rows[0]);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});