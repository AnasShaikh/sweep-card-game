import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './src/db.js';
import { 
  createUser, 
  authenticateUser, 
  generateToken, 
  authenticateToken, 
  getUserById,
  verifyToken 
} from './src/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Session middleware (keeping for backward compatibility with existing game logic)
app.use(session({
  secret: 'seep-game-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.json());
app.use(express.static('dist'));

// In-memory storage for games (will be migrated to database later)
const games = {};

// Helper function to get games from database
const getGamesFromDB = async (userId = null) => {
  try {
    let query, params;
    
    if (userId) {
      // Get both waiting games AND user's active games
      query = `
        SELECT 
          g.id,
          g.status,
          g.players,
          g.player_names,
          u.username as creator_username,
          CASE 
            WHEN (g.players->>'plyr1')::int = $1 OR (g.players->>'plyr2')::int = $1 OR (g.players->>'plyr3')::int = $1 OR (g.players->>'plyr4')::int = $1 THEN 'participant'
            ELSE 'available'
          END as user_relation
        FROM games g
        JOIN users u ON g.creator_id = u.id
        WHERE g.status = 'waiting' 
           OR (g.status = 'playing' AND ((g.players->>'plyr1')::int = $1 OR (g.players->>'plyr2')::int = $1 OR (g.players->>'plyr3')::int = $1 OR (g.players->>'plyr4')::int = $1))
        ORDER BY g.created_at DESC
      `;
      params = [userId];
    } else {
      // Original query for waiting games only
      query = `
        SELECT 
          g.id,
          g.status,
          g.players,
          g.player_names,
          u.username as creator_username,
          'available' as user_relation
        FROM games g
        JOIN users u ON g.creator_id = u.id
        WHERE g.status = 'waiting'
        ORDER BY g.created_at DESC
      `;
      params = [];
    }
    
    const result = await pool.query(query, params);
    
    return result.rows.map(game => ({
      id: game.id,
      creator: game.creator_username,
      players: Object.values(game.player_names || {}).filter(Boolean).length,
      maxPlayers: 4,
      status: game.status,
      userRelation: game.user_relation
    }));
  } catch (error) {
    console.error('Error fetching games from database:', error);
    return [];
  }
};

// Helper function to create game in database
const createGameInDB = async (creatorId, gameId) => {
  try {
    const creatorUser = await getUserById(creatorId);
    if (!creatorUser) throw new Error('Creator user not found');

    const players = {
      plyr1: creatorId,
      plyr2: null,
      plyr3: null,
      plyr4: null
    };
    
    const playerNames = {
      plyr1: creatorUser.username,
      plyr2: null,
      plyr3: null,
      plyr4: null
    };

    await pool.query(`
      INSERT INTO games (id, creator_id, status, players, player_names, game_state)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [gameId, creatorId, 'waiting', JSON.stringify(players), JSON.stringify(playerNames), null]);

    return {
      id: gameId,
      creator: creatorId,
      players,
      playerNames,
      status: 'waiting',
      gameState: null
    };
  } catch (error) {
    console.error('Error creating game in database:', error);
    throw error;
  }
};

// Helper function to get game from database
const getGameFromDB = async (gameId) => {
  try {
    const result = await pool.query(`
      SELECT g.*, u.username as creator_username
      FROM games g
      JOIN users u ON g.creator_id = u.id
      WHERE g.id = $1
    `, [gameId]);

    if (result.rows.length === 0) return null;

    const game = result.rows[0];
    return {
      id: game.id,
      creator: game.creator_id,
      players: game.players,
      playerNames: game.player_names,
      status: game.status,
      gameState: game.game_state
    };
  } catch (error) {
    console.error('Error fetching game from database:', error);
    return null;
  }
};

// Helper function to update game in database
const updateGameInDB = async (gameId, updates) => {
  try {
    const updateFields = [];
    const values = [];
    let valueIndex = 1;

    if (updates.status !== undefined) {
      updateFields.push(`status = $${valueIndex++}`);
      values.push(updates.status);
    }
    if (updates.players !== undefined) {
      updateFields.push(`players = $${valueIndex++}`);
      values.push(JSON.stringify(updates.players));
    }
    if (updates.playerNames !== undefined) {
      updateFields.push(`player_names = $${valueIndex++}`);
      values.push(JSON.stringify(updates.playerNames));
    }
    if (updates.gameState !== undefined) {
      updateFields.push(`game_state = $${valueIndex++}`);
      values.push(JSON.stringify(updates.gameState));
    }

    if (updateFields.length === 0) return;

    values.push(gameId);
    const query = `
      UPDATE games 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${valueIndex}
    `;

    await pool.query(query, values);
  } catch (error) {
    console.error('Error updating game in database:', error);
    throw error;
  }
};

// AUTH ROUTES

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters long' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  try {
    const user = await createUser(username.trim(), password);
    const token = generateToken(user.id, user.username);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    const user = await authenticateUser(username.trim(), password);
    const token = generateToken(user.id, user.username);
    
    // Also set session for backward compatibility
    req.session.userId = user.id;
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Verify token endpoint
app.get('/api/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username
    }
  });
});

// GAME ROUTES (Protected)

// Create new game
app.post('/api/games', authenticateToken, async (req, res) => {
  try {
    const gameId = uuidv4();
    const gameData = await createGameInDB(req.user.id, gameId);
    
    // Also store in memory for socket compatibility
    games[gameId] = gameData;
    
    res.json({ gameId });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get available games
app.get('/api/games', authenticateToken, async (req, res) => {
  try {
    const availableGames = await getGamesFromDB(req.user.id);
    res.json(availableGames);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get specific game
app.get('/api/games/:gameId', authenticateToken, async (req, res) => {
  const { gameId } = req.params;
  
  try {
    let game = await getGameFromDB(gameId);
    
    if (!game) {
      // Fallback to memory storage
      game = games[gameId];
    }
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Catch-all to serve the React app
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Socket.io logic with JWT authentication
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('authenticate', async (userData) => {
    if (userData?.token) {
      // Verify JWT token
      const decoded = verifyToken(userData.token);
      if (decoded) {
        try {
          const user = await getUserById(decoded.userId);
          if (user) {
            socket.userId = user.id;
            socket.username = user.username;
            console.log(`Socket ${socket.id} authenticated as user ${user.username} (${user.id})`);
          }
        } catch (error) {
          console.error('Error authenticating socket user:', error);
        }
      }
    } else if (userData?.userId) {
      // Fallback for old authentication method
      socket.userId = userData.userId;
      socket.username = userData.username;
      console.log(`Socket ${socket.id} authenticated as user ${userData.username} (${userData.userId})`);
    }
  });
  
  socket.on('joinRoom', async ({ gameId, userId }) => {
    console.log(`User ${userId} trying to join room ${gameId}`);
    
    try {
      let game = await getGameFromDB(gameId);
      if (!game) {
        game = games[gameId];
      }
      
      if (game) {
        socket.join(gameId);
        console.log(`Socket ${socket.id} (user: ${userId}) successfully joined room ${gameId}`);
        
        socket.emit('gameUpdate', game);
        console.log(`Sent game state to user ${userId}:`, game);
      } else {
        console.log(`Game ${gameId} not found`);
      }
    } catch (error) {
      console.error('Error in joinRoom:', error);
    }
  });
  
  socket.on('joinGame', async ({ userId, gameId, position }) => {
    console.log(`Join game: ${userId} -> ${gameId} at ${position}`);
    
    try {
      let game = await getGameFromDB(gameId);
      if (!game) {
        game = games[gameId];
      }
      
      if (!game) {
        return socket.emit('error', 'Game not found');
      }
      
      if (game.players[position]) {
        return socket.emit('error', 'Position already taken');
      }
      
      const user = await getUserById(userId);
      if (!user) {
        return socket.emit('error', 'User not found');
      }
      
      // Update game data
      game.players[position] = userId;
      game.playerNames[position] = user.username;
      
      // Update in database
      await updateGameInDB(gameId, {
        players: game.players,
        playerNames: game.playerNames
      });
      
      // Update memory storage for socket compatibility
      games[gameId] = game;
      
      console.log(`${user.username} joined ${gameId} at ${position}`);
      
      // Broadcast update to ALL players in the room
      io.to(gameId).emit('gameUpdate', game);
    } catch (error) {
      console.error('Error in joinGame:', error);
      socket.emit('error', 'Server error');
    }
  });
  
  socket.on('startGame', async ({ userId, gameId }) => {
    console.log(`Start game: ${userId} -> ${gameId}`);
    
    try {
      let game = await getGameFromDB(gameId);
      if (!game) {
        game = games[gameId];
      }
      
      if (!game) {
        return socket.emit('error', 'Game not found');
      }
      
      // Check if all positions filled
      const playerCount = Object.values(game.players).filter(Boolean).length;
      if (playerCount !== 4) {
        return socket.emit('error', 'Need 4 players to start');
      }
      
      // Start the game
      game.status = 'playing';
      game.gameState = {
        currentTurn: 'plyr2',
        moveCount: 0,
        dealVisible: true,
        collectedCards: { plyr1: [], plyr2: [], plyr3: [], plyr4: [] }
      };
      
      // Update in database
      await updateGameInDB(gameId, {
        status: game.status,
        gameState: game.gameState
      });
      
      // Update memory storage
      games[gameId] = game;
      
      console.log(`Game ${gameId} started with plyr2 going first`);
      
      // Broadcast game start
      io.to(gameId).emit('gameStarted', game);
    } catch (error) {
      console.error('Error in startGame:', error);
      socket.emit('error', 'Server error');
    }
  });
  
  socket.on('gameAction', async ({ userId, gameId, action, data }) => {
    try {
      let game = await getGameFromDB(gameId);
      if (!game) {
        game = games[gameId];
      }
      
      if (!game) {
        return socket.emit('error', 'Game not found');
      }
      
      // Update game state
      if (action === 'updateGameState') {
        game.gameState = data;
        
        // Update in database
        await updateGameInDB(gameId, { gameState: data });
        
        // Update memory storage
        games[gameId] = game;
      }
      
      // Broadcast to all players in the game
      socket.to(gameId).emit('gameAction', { 
        player: userId, 
        action, 
        data 
      });
    } catch (error) {
      console.error('Error in gameAction:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Database connection test
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