import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Table from './table';

const GameRoom = ({ user, authenticatedFetch }) => {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');
  const [gameStateLoaded, setGameStateLoaded] = useState(false);
  const navigate = useNavigate();
  
  const socketRef = useRef(null);
  const gameStateRef = useRef(null);
  
  useEffect(() => {
    // Clean up previous socket if exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Reset state when navigating to different game
    setGameStateLoaded(false);
    setGame(null);
    setError('');
    gameStateRef.current = null;
    
    const newSocket = io();
    setSocket(newSocket);
    socketRef.current = newSocket;
    
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      
      // Authenticate socket with JWT token
      const token = localStorage.getItem('auth_token');
      newSocket.emit('authenticate', { 
        token: token,
        userId: user.id, 
        username: user.username 
      });
      
      // Join the game room after authentication
      newSocket.emit('joinRoom', { gameId, userId: user.id });
      
      console.log(`User ${user.username} attempting to join room ${gameId}`);
    });
    
    // Define event handlers
    const handleGameUpdate = (updatedGame) => {
      console.log(`${user.username} received game update:`, updatedGame);
      
      // Only update if this is more recent than what we have
      const currentTimestamp = gameStateRef.current?.timestamp || 0;
      const newTimestamp = Date.now();
      
      if (newTimestamp > currentTimestamp) {
        gameStateRef.current = { ...updatedGame, timestamp: newTimestamp };
        setGame(updatedGame);
        setGameStateLoaded(true);
      }
    };
    
    const handleGameStarted = (startedGame) => {
      console.log(`Game started, redirecting to table...`);
      const timestamp = Date.now();
      gameStateRef.current = { ...startedGame, timestamp };
      setGame(startedGame);
      setGameStateLoaded(true);
    };
    
    const handleGameTerminated = ({ terminatedBy, gameId }) => {
      console.log(`Game ${gameId} was terminated by user ${terminatedBy}`);
      setError(`Game was terminated by a player`);
      
      // Redirect to lobby after 3 seconds
      setTimeout(() => {
        navigate('/lobby');
      }, 3000);
    };
    
    const handleError = (errorMsg) => {
      console.error('Socket error:', errorMsg);
      setError(errorMsg);
      
      // If error is related to authentication, redirect to login
      if (errorMsg.includes('authentication') || errorMsg.includes('token')) {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        navigate('/');
      }
    };
    
    // Register event listeners
    newSocket.on('gameUpdate', handleGameUpdate);
    newSocket.on('gameStarted', handleGameStarted);
    newSocket.on('gameTerminated', handleGameTerminated);
    newSocket.on('error', handleError);
    
    // Load initial game state
    loadGame();
    
    // Cleanup function
    return () => {
      newSocket.off('gameUpdate', handleGameUpdate);
      newSocket.off('gameStarted', handleGameStarted);
      newSocket.off('gameTerminated', handleGameTerminated);
      newSocket.off('error', handleError);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [gameId, user.id, user.username, navigate]); 
  
  const loadGame = async () => {
    try {
      console.log(`Loading game ${gameId} from database...`);
      const response = await authenticatedFetch(`/api/games/${gameId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load game');
      }
      
      const data = await response.json();
      console.log('Game loaded from database:', data);
      
      // Always use database state as source of truth for resume
      const timestamp = Date.now();
      gameStateRef.current = { ...data, timestamp };
      setGame(data);
      setGameStateLoaded(true);
      setError('');
    } catch (err) {
      console.error('Error loading game:', err);
      setError(err.message);
      
      // If game not found or authentication failed, go back to lobby
      if (err.message.includes('not found') || err.message.includes('Authentication failed')) {
        setTimeout(() => navigate('/lobby'), 2000);
      }
    }
  };
  
  const joinGame = () => {
    if (!game || !socket) {
      setError('Unable to join game. Please try refreshing the page.');
      return;
    }
    
    // Find first available position
    const availablePosition = ['plyr1', 'plyr2', 'plyr3', 'plyr4']
      .find(pos => !game.players[pos]);
    
    if (!availablePosition) {
      setError('Game is full');
      return;
    }
    
    socket.emit('joinGame', {
      userId: user.id,
      gameId,
      position: availablePosition
    });
  };
  
  const startGame = () => {
    if (!socket) {
      setError('Unable to start game. Please try refreshing the page.');
      return;
    }
    
    socket.emit('startGame', {
      userId: user.id,
      gameId
    });
  };
  
  const terminateGame = () => {
    if (!socket) {
      setError('Unable to terminate game. Please try refreshing the page.');
      return;
    }
    
    const confirmed = window.confirm(
      'Are you sure you want to terminate this game? This action cannot be undone and will end the game for all players.'
    );
    
    if (confirmed) {
      socket.emit('terminateGame', {
        userId: user.id,
        gameId
      });
    }
  };
  
  const fillWithBots = async () => {
    try {
      setError('');
      
      const response = await authenticatedFetch(`/api/games/${gameId}/fill-bots`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add bots');
      }
      
      const data = await response.json();
      console.log('Bots added successfully:', data);
      
      // Refresh game data to show updated player count
      await loadGame();
    } catch (err) {
      console.error('Error adding bots:', err);
      setError(err.message);
    }
  };
  
  const getUserPosition = () => {
    if (!game) return null;
    return Object.entries(game.players)
      .find(([pos, playerId]) => playerId === user.id)?.[0] || null;
  };
  
  const isUserInGame = () => {
    if (!game) return false;
    return Object.values(game.players).includes(user.id);
  };
  
  const getPlayerCount = () => {
    if (!game) return 0;
    return Object.values(game.players).filter(Boolean).length;
  };
  
  const canStartGame = () => {
    return getPlayerCount() === 4;
  };
  
  // Error handling display
  if (error && error.includes('not found')) {
    return (
      <div className="game-room">
        <h2>Game Not Found</h2>
        <p>The game you're looking for doesn't exist or has been removed.</p>
        <div className="secondary-actions">
          <button onClick={() => navigate('/lobby')} className="btn back-btn">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }
  
  if (!game && !error) {
    return <div className="loading">Loading game...</div>;
  }
  
  // Show table if game is playing - but only after game state is properly loaded
  if (game && game.status === 'playing' && gameStateLoaded) {
    const userPosition = getUserPosition();
    
    if (!userPosition) {
      return (
        <div className="game-room">
          <h2>Game In Progress</h2>
          <p>This game has already started and you're not a participant.</p>
          <div className="secondary-actions">
            <button onClick={() => navigate('/lobby')} className="btn back-btn">
              Back to Lobby
            </button>
          </div>
        </div>
      );
    }
    
    // Add debug logging for Table component
    console.log('=== RENDERING TABLE COMPONENT ===');
    console.log('Game state being passed to Table:', game.gameState);
    console.log('User position:', userPosition);
    console.log('Player names:', game.playerNames);
    
    return (
      <div className="game-room">
        <Table 
          key={`${gameId}-${gameStateLoaded}-${Date.now()}`} // Force re-render on state load
          gameId={gameId}
          user={user}
          position={userPosition}
          playerNames={game.playerNames || {}}
          socket={socket}
          onGameAction={(action, data) => {
            socket.emit('gameAction', { userId: user.id, gameId, action, data });
          }}
          initialGameState={game.gameState}
          onTerminateGame={terminateGame}
        />
        <div className="game-room-actions">
          <button onClick={() => navigate('/lobby')} className="btn back-btn">
            Back to Lobby
          </button>
          <button onClick={terminateGame} className="btn terminate-btn">
            End Game
          </button>
        </div>
      </div>
    );
  }
  
  // Show loading while game state is being loaded for playing games
  if (game && game.status === 'playing' && !gameStateLoaded) {
    return <div className="loading">Loading game state...</div>;
  }
  
  // Show waiting room
  const playerCount = game ? getPlayerCount() : 0;
  
  return (
    <div className="game-room">
      <h2>Game Room</h2>
      
      {game && (
        <div className="game-info">
          <p><strong>Game ID:</strong> {gameId}</p>
          <p><strong>Players:</strong> {playerCount}/4</p>
          <p><strong>Status:</strong> {game.status}</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
          {error.includes('Authentication failed') && (
            <p>Please log in again to continue.</p>
          )}
        </div>
      )}
      
      {game && (
        <div className="players-list">
          <h3>Players</h3>
          <div className="player-positions">
            {['plyr1', 'plyr2', 'plyr3', 'plyr4'].map((pos) => {
              const playerId = game.players[pos];
              const playerName = game.playerNames?.[pos];
              const isMe = playerId === user.id;
              
              // Handle both string names (human players) and object names (bots)
              const displayName = typeof playerName === 'object' && playerName?.name 
                ? `${playerName.name} (Bot)` 
                : playerName || 'Empty';
              
              return (
                <div key={pos} className={`player-slot ${isMe ? 'current-user' : ''} ${playerId ? 'occupied' : 'empty'}`}>
                  <strong>{pos}:</strong> {displayName}
                  {isMe && ' (You)'}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="game-actions">
        {game && !isUserInGame() && playerCount < 4 && (
          <div className="primary-actions">
            <button onClick={joinGame} className="btn join-game-btn">
              Join Game
            </button>
          </div>
        )}
        
        {game && isUserInGame() && playerCount < 4 && (
          <div className="waiting-message">
            <p>Waiting for more players... ({playerCount}/4)</p>
            <small>Share this game ID with friends: <strong>{gameId}</strong></small>
          </div>
        )}
        
        {game && playerCount === 4 && game.status === 'waiting' && (
          <div className="primary-actions">
            <button onClick={startGame} className="btn start-game-btn">
              Start Game (All players ready!)
            </button>
          </div>
        )}
        
        <div className="secondary-actions">
          {game && (
            <button onClick={loadGame} className="btn refresh-btn">
              Refresh Game
            </button>
          )}
          
          {game && playerCount < 4 && isUserInGame() && (
            <button onClick={() => fillWithBots()} className="btn fill-bots-btn">
              Fill with Bots
            </button>
          )}
          
          <button onClick={() => navigate('/lobby')} className="btn back-btn">
            Back to Lobby
          </button>
          
          {game && isUserInGame() && (
            <button onClick={terminateGame} className="btn terminate-btn">
              End Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameRoom;