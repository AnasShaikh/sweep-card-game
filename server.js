
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// In-memory storage for users and games
const users = {};
const games = {};

// API routes
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  // Simple login - just store the username
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
      plyr1: userId,
      plyr2: null,
      plyr3: null,
      plyr4: null
    },
    playerNames: {
      plyr1: users[userId].username,
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
      creator: users[game.creator].username,
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
  
  // Store user authentication on socket connection
  socket.on('authenticate', (userData) => {
    if (userData && userData.userId) {
      // Store the user info on the socket
      socket.userId = userData.userId;
      console.log(`Socket ${socket.id} authenticated as user ${userData.userId}`);
      
      // Create user if doesn't exist (in case of page refresh or new tab)
      if (!users[userData.userId]) {
        users[userData.userId] = { 
          id: userData.userId, 
          username: userData.username, 
          currentGame: null 
        };
        console.log(`Created missing user: ${userData.username} (${userData.userId})`);
      }
    }
  });
  
  socket.on('joinGame', ({ userId, gameId, position }) => {
    console.log(`Join game request: User ${userId} trying to join game ${gameId} at position ${position}`);
    
    // Use socket's authenticated userId if available and userId doesn't exist
    if (!users[userId] && socket.userId && users[socket.userId]) {
      console.log(`User ${userId} not found, using socket's authenticated user ${socket.userId} instead`);
      userId = socket.userId;
    }
    
    // Final check if user exists
    if (!users[userId]) {
      console.log(`User ${userId} not found and no authenticated user available`);
      return socket.emit('error', 'Invalid user - please log in again');
    }
    
    if (!games[gameId]) {
      console.log(`Game ${gameId} not found`);
      return socket.emit('error', 'Game not found');
    }
    
    // Check if position is available
    if (games[gameId].players[position]) {
      console.log(`Position ${position} already taken`);
      return socket.emit('error', 'Position already taken');
    }
    
    // Join the game
    games[gameId].players[position] = userId;
    games[gameId].playerNames[position] = users[userId].username;
    users[userId].currentGame = gameId;
    
    console.log(`User ${users[userId].username} joined game ${gameId} at position ${position}`);
    
    // Join the socket room for this game
    socket.join(gameId);
    
    // Check if all 4 players have joined
    const playerCount = Object.values(games[gameId].players).filter(Boolean).length;
    if (playerCount === 4 && games[gameId].status === 'waiting') {
      // Start the game automatically
      games[gameId].status = 'playing';
      console.log(`All 4 players joined game ${gameId}. Starting automatically.`);
      io.to(gameId).emit('gameStarted', games[gameId]);
    } else {
      // Broadcast updated game state to all players
      io.to(gameId).emit('gameUpdate', games[gameId]);
    }
  });
  
  socket.on('startGame', ({ userId, gameId }) => {
    if (!users[userId] || !games[gameId] || games[gameId].creator !== userId) {
      return socket.emit('error', 'Not authorized to start game');
    }
    
    games[gameId].status = 'playing';
    io.to(gameId).emit('gameStarted', games[gameId]);
  });
  
  socket.on('gameAction', ({ userId, gameId, action, data }) => {
    if (!users[userId] || !games[gameId]) {
      return socket.emit('error', 'Invalid user or game');
    }
    
    // Store game state
    if (action === 'updateGameState') {
      games[gameId].gameState = data;
    }
    
    // Broadcast the action to all players in the game
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
