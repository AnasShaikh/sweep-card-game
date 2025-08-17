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
import { generateBotMove } from './src/botAI.js';

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

// Timer management for move timeouts
const gameTimers = new Map(); // gameId -> { timerId, playerId, startTime }
const MOVE_TIMEOUT_SECONDS = 30;

// Timer management functions
function clearMoveTimer(gameId) {
  const timerData = gameTimers.get(gameId);
  if (timerData) {
    clearTimeout(timerData.timerId);
    gameTimers.delete(gameId);
    console.log(`⏹️ Timer cleared for game ${gameId}, was for player ${timerData.playerId}`);
    
    // Broadcast timer stop to all players
    io.to(gameId).emit('timerStop', {
      playerId: timerData.playerId
    });
  } else {
    console.log(`⚠️ No timer found to clear for game ${gameId}`);
  }
}

function startMoveTimer(gameId, playerId, playerData) {
  // Don't start timers for bot players
  if (typeof playerData === 'object' && playerData.isBot) {
    console.log(`Skipping timer for bot ${playerData.name}`);
    return;
  }

  // Check if there's already an active timer for this game
  const existingTimer = gameTimers.get(gameId);
  if (existingTimer) {
    console.log(`⚠️ Timer already active for game ${gameId} (player: ${existingTimer.playerId}), clearing it first`);
    clearMoveTimer(gameId);
  }

  const timerId = setTimeout(async () => {
    console.log(`⏰ Timer expired for player ${playerId} in game ${gameId}`);
    await executeAutoMove(gameId, playerId);
  }, MOVE_TIMEOUT_SECONDS * 1000);

  const startTime = Date.now();
  gameTimers.set(gameId, { timerId, playerId, startTime });

  console.log(`⏱️ Timer started for player ${playerId} in game ${gameId} (${MOVE_TIMEOUT_SECONDS}s)`);

  // Special debug for player 4 timer broadcast
  if (playerId === 'plyr4') {
    console.log('🚨 PLAYER 4 SERVER TIMER DEBUG:', {
      gameId,
      playerId,
      timeLimit: MOVE_TIMEOUT_SECONDS,
      startTime,
      roomMembers: Array.from(io.sockets.adapter.rooms.get(gameId) || [])
    });
  }

  // Broadcast timer start to all players
  io.to(gameId).emit('timerStart', {
    playerId,
    timeLimit: MOVE_TIMEOUT_SECONDS,
    startTime
  });
  
  // Extra verification for player 4
  if (playerId === 'plyr4') {
    console.log('🚨 TIMER BROADCAST SENT FOR PLAYER 4');
  }
}

async function executeAutoMove(gameId, playerId) {
  try {
    // Get current game state
    let game = await getGameFromDB(gameId);
    if (!game) {
      game = games[gameId];
    }

    if (!game || !game.gameState) {
      console.log(`Cannot execute auto move: game ${gameId} not found`);
      return;
    }

    const gameState = game.gameState;
    
    // Check if it's still this player's turn
    if (gameState.currentTurn !== playerId) {
      console.log(`Timer expired for ${playerId} but it's now ${gameState.currentTurn}'s turn. Ignoring.`);
      return;
    }
    
    const playerHand = gameState.players[playerId];

    if (!playerHand || playerHand.length === 0) {
      console.log(`Cannot execute auto move: player ${playerId} has no cards`);
      return;
    }

    // Pick a random card from player's hand
    const randomIndex = Math.floor(Math.random() * playerHand.length);
    const randomCard = playerHand[randomIndex];

    console.log(`🎲 Auto-throwing random card for ${playerId}: ${randomCard}`);

    // Execute throw away action using existing game logic
    const { handleThrowAway } = await import('./src/tableActions.js');
    
    const result = handleThrowAway(
      randomCard,
      gameState.call,
      gameState.moveCount,
      gameState.players,
      playerId,
      gameState.collectedCards,
      gameState.team1Points,
      gameState.team2Points,
      gameState.team1SeepCount,
      gameState.team2SeepCount,
      gameState.lastCollector,
      null // no onGameAction callback needed here
    );

    if (result) {
      // Update game state
      const updatedGameState = {
        ...gameState,
        players: result.newPlayers,
        currentTurn: result.nextPlayerTurn,
        moveCount: result.nextMoveCount,
        showDRCButton: result.nextShowDRCButton,
        lastCollector: result.newLastCollector
      };

      game.gameState = updatedGameState;

      // Update in database
      await updateGameInDB(gameId, { gameState: updatedGameState });

      // Update memory storage
      games[gameId] = game;

      // Clear the timer
      clearMoveTimer(gameId);

      // Broadcast the auto move to all players
      io.to(gameId).emit('gameAction', {
        player: playerId,
        action: 'autoMove',
        data: {
          ...updatedGameState,
          autoThrownCard: randomCard,
          isTimeout: true
        }
      });

      // Start timer for next player if they're not a bot
      const nextPlayerId = game.players[result.nextPlayerTurn];
      const nextPlayerData = game.playerNames[result.nextPlayerTurn];
      
      if (nextPlayerId && !(typeof nextPlayerData === 'object' && nextPlayerData.isBot)) {
        startMoveTimer(gameId, result.nextPlayerTurn, nextPlayerData);
      }

      console.log(`✅ Auto move completed for ${playerId}, turn passed to ${result.nextPlayerTurn}`);
    }
  } catch (error) {
    console.error('Error executing auto move:', error);
  }
}

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
        WHERE (g.status = 'waiting' 
           OR (g.status = 'playing' AND ((g.players->>'plyr1')::int = $1 OR (g.players->>'plyr2')::int = $1 OR (g.players->>'plyr3')::int = $1 OR (g.players->>'plyr4')::int = $1)))
           AND g.status != 'finished'
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
    
    console.log(`🎯 DEBUG: getGamesFromDB found ${result.rows.length} games for user ${userId}`);
    result.rows.forEach(game => {
      console.log(`🎯 DEBUG: Game ${game.id} - Status: ${game.status}, User relation: ${game.user_relation || 'N/A'}`);
    });
    
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

// Get specific game - ENHANCED for better state synchronization
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
    
    // CRITICAL: Always sync memory with database for consistency
    if (game) {
      games[gameId] = game;
    }
    
    console.log(`Game ${gameId} state retrieved:`, {
      status: game.status,
      gameState: game.gameState ? 'present' : 'null',
      players: game.players
    });
    
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Fill game with bots
app.post('/api/games/:gameId/fill-bots', authenticateToken, async (req, res) => {
  const { gameId } = req.params;
  
  try {
    let game = await getGameFromDB(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Can only add bots to waiting games' });
    }
    
    // Count current players
    const currentPlayers = Object.values(game.players).filter(Boolean).length;
    if (currentPlayers >= 4) {
      return res.status(400).json({ error: 'Game is already full' });
    }
    
    // Add bots to fill remaining slots
    const updatedPlayers = { ...game.players };
    const updatedPlayerNames = { ...game.playerNames };
    let botCount = 1;
    
    for (const position of ['plyr1', 'plyr2', 'plyr3', 'plyr4']) {
      if (!updatedPlayers[position]) {
        const botId = -botCount; // Negative IDs for bots
        updatedPlayers[position] = botId;
        updatedPlayerNames[position] = {
          name: `Bot ${botCount}`,
          isBot: true,
          difficulty: 'easy'
        };
        botCount++;
      }
    }
    
    // Update game in database
    await updateGameInDB(gameId, {
      players: updatedPlayers,
      playerNames: updatedPlayerNames
    });
    
    // Update memory storage for consistency
    if (games[gameId]) {
      games[gameId].players = updatedPlayers;
      games[gameId].playerNames = updatedPlayerNames;
    }
    
    res.json({ 
      success: true, 
      message: 'Bots added successfully',
      players: updatedPlayers,
      playerNames: updatedPlayerNames
    });
  } catch (error) {
    console.error('Error adding bots to game:', error);
    res.status(500).json({ error: 'Failed to add bots' });
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
      // ALWAYS get fresh state from database for join room
      let game = await getGameFromDB(gameId);
      if (!game) {
        game = games[gameId];
      }
      
      if (game) {
        socket.join(gameId);
        console.log(`Socket ${socket.id} (user: ${userId}) successfully joined room ${gameId}`);
        
        // Special debug for player 4 room membership
        const playerPosition = Object.entries(game.players).find(([pos, id]) => id === userId)?.[0];
        if (playerPosition === 'plyr4') {
          console.log('🚨 PLAYER 4 ROOM JOIN DEBUG:', {
            userId,
            socketId: socket.id,
            gameId,
            playerPosition,
            roomMembers: Array.from(io.sockets.adapter.rooms.get(gameId) || [])
          });
        }
        
        // Sync memory with database
        games[gameId] = game;
        
        socket.emit('gameUpdate', game);
        console.log(`Sent fresh game state to user ${userId}:`, {
          status: game.status,
          gameState: game.gameState ? 'present' : 'null'
        });
      } else {
        console.log(`Game ${gameId} not found`);
        socket.emit('error', 'Game not found');
      }
    } catch (error) {
      console.error('Error in joinRoom:', error);
      socket.emit('error', 'Server error');
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
    
    // Import required functions
    const { shuffleDeck, getCardValue, formatCardName, checkValidCalls } = await import('./src/tableLogic.js');
    const initialDeck = await import('./src/initialDeck.js');
    
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loop
    let newPlayers;
    let shuffledDeck;
    
    // Keep redistributing cards until plyr2 has valid call cards
    do {
      shuffledDeck = shuffleDeck([...initialDeck.default]);
      newPlayers = {
        plyr1: shuffledDeck.splice(0, 4),
        plyr2: shuffledDeck.splice(0, 4), 
        plyr3: shuffledDeck.splice(0, 4),
        plyr4: shuffledDeck.splice(0, 4),
        board: shuffledDeck.splice(0, 4)
      };
      
      attempts++;
      
      // Check if plyr2 has any valid call cards (9, 10, 11, 12, 13)
      const validCalls = checkValidCalls(newPlayers.plyr2);
      
      if (validCalls.length > 0) {
        console.log(`Valid deal found after ${attempts} attempts. Plyr2 can call: ${validCalls.join(', ')}`);
        break;
      }
      
      console.log(`Attempt ${attempts}: Plyr2 has no valid call cards, redistributing...`);
      
      if (attempts >= maxAttempts) {
        console.error(`Failed to find valid deal after ${maxAttempts} attempts`);
        return socket.emit('error', 'Unable to deal valid cards. Please try again.');
      }
      
    } while (true);
    
    // Start the game with valid card distribution
    game.status = 'playing';
    game.gameState = {
      deck: shuffledDeck,
      players: newPlayers,
      currentTurn: 'plyr2',
      moveCount: 1, // Start at 1 since cards are dealt
      boardVisible: false,
      dealVisible: false, // No deal button needed
      call: null,
      collectedCards: { plyr1: [], plyr2: [], plyr3: [], plyr4: [] },
      remainingCardsDealt: false,
      showDRCButton: false,
      team1SeepCount: 0,
      team2SeepCount: 0,
      team1Points: 0,
      team2Points: 0,
      lastCollector: null
    };
    
    // Update in database FIRST
    await updateGameInDB(gameId, {
      status: game.status,
      gameState: game.gameState
    });
    
    // Then update memory storage
    games[gameId] = game;
    
    console.log(`Game ${gameId} started with valid card distribution after ${attempts} attempts. Plyr2 goes first.`);
    
    // Broadcast game start with cards already dealt
    io.to(gameId).emit('gameStarted', game);

    // Start timer for the first player (plyr2) if they're not a bot
    const firstPlayerId = game.players['plyr2'];
    const firstPlayerData = game.playerNames['plyr2'];
    
    if (firstPlayerId && !(typeof firstPlayerData === 'object' && firstPlayerData.isBot)) {
      console.log(`Starting timer for first player: plyr2`);
      startMoveTimer(gameId, 'plyr2', firstPlayerData);
    }
  } catch (error) {
    console.error('Error in startGame:', error);
    socket.emit('error', 'Server error');
  }
});
  
  // NEW: Terminate game handler
  socket.on('terminateGame', async ({ userId, gameId }) => {
    console.log(`Terminate game: ${userId} -> ${gameId}`);
    
    try {
      let game = await getGameFromDB(gameId);
      if (!game) {
        game = games[gameId];
      }
      
      if (!game) {
        return socket.emit('error', 'Game not found');
      }
      
      // Verify user is in the game
      if (!Object.values(game.players).includes(userId)) {
        return socket.emit('error', 'You are not a participant in this game');
      }
      
      // Update game status to terminated
      game.status = 'terminated';
      
      // Clear any active timer
      clearMoveTimer(gameId);
      
      // Update in database FIRST
      await updateGameInDB(gameId, {
        status: 'terminated'
      });
      
      // Then update memory storage
      games[gameId] = game;
      
      console.log(`Game ${gameId} terminated by user ${userId}`);
      
      // Broadcast termination to all players in the game
      io.to(gameId).emit('gameTerminated', { 
        terminatedBy: userId,
        gameId: gameId
      });
    } catch (error) {
      console.error('Error in terminateGame:', error);
      socket.emit('error', 'Server error during game termination');
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
        
        // Update in database FIRST
        await updateGameInDB(gameId, { gameState: data });
        
        // Then update memory storage
        games[gameId] = game;
        
        console.log(`Game ${gameId} state updated by ${userId}:`, {
          action,
          moveCount: data.moveCount,
          currentTurn: data.currentTurn
        });
      } else if (action === 'gameFinished') {
        console.log(`🎯 DEBUG: Received gameFinished action for game ${gameId}`);
        console.log(`🎯 DEBUG: Game data:`, data);
        console.log(`🎯 DEBUG: Current game status:`, game.status);
        
        // Mark game as finished
        game.status = 'finished';
        
        // Clear any active timer
        clearMoveTimer(gameId);
        
        // Update in database
        console.log(`🎯 DEBUG: Updating database status to 'finished'`);
        await updateGameInDB(gameId, { 
          status: 'finished',
          gameState: { ...game.gameState, finished: true, winner: data.winner, finalScores: data.finalScores }
        });
        
        // Update memory storage
        games[gameId] = game;
        
        console.log(`🏆 Game ${gameId} finished! Winner: ${data.winnerName}, Scores:`, data.finalScores);
        console.log(`🎯 DEBUG: Game status now set to:`, game.status);
      }
      
      // Find the player position from userId for better client-side processing
      let playerPosition = null;
      for (const [pos, id] of Object.entries(game.players)) {
        if (id === userId) {
          playerPosition = pos;
          break;
        }
      }
      
      // Broadcast to all players in the game
      socket.to(gameId).emit('gameAction', { 
        player: userId,
        playerPosition, // Add position for easier client processing
        action, 
        data 
      });
      
      // Clear any existing timer on actual game actions (not just state updates)
      if (['makeCall', 'throwAway', 'pickup', 'stack'].includes(action)) {
        console.log(`🧹 Clearing timer due to action: ${action}`);
        clearMoveTimer(gameId);
      }

      // Check if it's now a bot's turn and trigger bot move OR start timer for human player
      if (action === 'updateGameState' && data.currentTurn) {
        // Simple logic: if no active timer exists for this game, start one for current turn
        const activeTimer = gameTimers.get(gameId);
        const needsTimer = !activeTimer;
        
        console.log(`🔍 Turn: ${data.currentTurn}, Active timer: ${activeTimer?.playerId || 'none'}, Needs timer: ${needsTimer}`);
        
        if (needsTimer) {
          const currentPlayerId = game.players[data.currentTurn];
          const currentPlayerData = game.playerNames[data.currentTurn];
          
          // Check if current player is a bot (negative ID and isBot flag)
          if (currentPlayerId < 0 && typeof currentPlayerData === 'object' && currentPlayerData.isBot) {
            console.log(`Bot ${currentPlayerData.name} (${data.currentTurn}) turn detected`);
            
            // Schedule bot move with delay to simulate thinking
            setTimeout(async () => {
              try {
                // Get the latest complete game state from database for bot move
                const latestGame = await getGameFromDB(gameId);
                const completeGameState = latestGame?.gameState || game.gameState || data;
                const botMove = generateBotMove(completeGameState, data.currentTurn);
                if (botMove) {
                  console.log(`Bot ${currentPlayerData.name} making move:`, botMove);
                  
                  const { action, ...moveData } = botMove;
                  
                  // Update game state with bot move, preserving current state
                  const currentGameState = game.gameState || data;
                  const updatedData = { ...currentGameState, ...moveData };
                  game.gameState = updatedData;
                  
                  // Update in database
                  await updateGameInDB(gameId, { gameState: updatedData });
                  
                  // Update memory storage
                  games[gameId] = game;
                  
                  // Broadcast bot move with correct action type
                  io.to(gameId).emit('gameAction', { 
                    player: currentPlayerId, 
                    action: action, 
                    data: moveData 
                  });
                }
              } catch (error) {
                console.error('Error in bot move:', error);
              }
            }, 1000 + Math.random() * 2000); // 1-3 second delay
          } else {
            // It's a human player's turn - start the move timer
            console.log(`🎯 Starting timer for human player ${data.currentTurn}`);
            startMoveTimer(gameId, data.currentTurn, currentPlayerData);
          }
        }
      }
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