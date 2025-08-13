import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Table from './table';

const GameRoom = ({ user, authenticatedFetch }) => {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Use ref to track auto-deal to avoid stale closures and ensure proper cleanup
  const autoDealtRef = useRef(false);
  const socketRef = useRef(null);
  
  // Reset auto-deal tracking when gameId changes (navigating between games)
  useEffect(() => {
    autoDealtRef.current = false;
  }, [gameId]);
  
  useEffect(() => {
    // Clean up previous socket if exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
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
      setGame(updatedGame);
      
      // Reset auto-deal flag when game returns to waiting status
      if (updatedGame.status === 'waiting') {
        autoDealtRef.current = false;
      }
    };
    
    const handleGameStarted = (startedGame) => {
      console.log(`${user.username} received game started:`, startedGame);
      setGame(startedGame);
    };
    
    const handleGameTerminated = ({ terminatedBy, gameId }) => {
      console.log(`Game ${gameId} was terminated by user ${terminatedBy}`);
      setError(`Game was terminated by a player`);
      
      // Reset auto-deal flag on termination
      autoDealtRef.current = false;
      
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
  
  // Auto-deal detection with proper state management
  useEffect(() => {
    // Only run if we have all required data and haven't already triggered auto-deal
    if (!game || !socket || autoDealtRef.current) return;
    
    // Check for limbo state: playing + moveCount 0 + user is participant
    if (game.status === 'playing' && 
        game.gameState && 
        game.gameState.moveCount === 0 && 
        Object.values(game.players).includes(user.id)) {
      
      // Check if cards have been dealt
      const hasPlayerCards = game.gameState.players && 
        Object.keys(game.gameState.players).some(playerKey => {
          if (playerKey === 'board') return false;
          const hand = game.gameState.players[playerKey];
          return Array.isArray(hand) && hand.length > 0;
        });
      
      const hasBoardCards = game.gameState.players && 
        Array.isArray(game.gameState.players.board) && 
        game.gameState.players.board.length > 0;
      
      if (!hasPlayerCards && !hasBoardCards) {
        // TRUE LIMBO: Auto-deal needed
        console.log('=== AUTO-DEAL TRIGGERED ===');
        console.log('Game in limbo state - no cards dealt yet');
        
        autoDealtRef.current = true; // Set flag immediately to prevent re-triggers
        socket.emit('autoDealCards', { userId: user.id, gameId });
      } else {
        // NORMAL RESUME: Game has cards, just resuming
        console.log('=== NORMAL RESUME ===');
        console.log('Game has cards - normal resume');
      }
    }
  }, [game, socket, user.id, gameId]);
  
  const loadGame = async () => {
    try {
      const response = await authenticatedFetch(`/api/games/${gameId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load game');
      }
      
      const data = await response.json();
      console.log('Game loaded:', data);
      setGame(data);
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
        <button onClick={() => navigate('/lobby')} className="back-btn">
          Back to Lobby
        </button>
      </div>
    );
  }
  
  if (!game && !error) {
    return <div className="loading">Loading game...</div>;
  }
  
  // Show table if game is playing
  if (game && game.status === 'playing') {
    const userPosition = getUserPosition();
    
    if (!userPosition) {
      return (
        <div className="game-room">
          <h2>Game In Progress</h2>
          <p>This game has already started and you're not a participant.</p>
          <button onClick={() => navigate('/lobby')} className="back-btn">
            Back to Lobby
          </button>
        </div>
      );
    }
    
    return (
      <div className="game-room">
        <Table 
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
          <button onClick={() => navigate('/lobby')} className="back-btn">
            Back to Lobby
          </button>
          <button onClick={terminateGame} className="terminate-btn" style={{backgroundColor: '#dc3545', color: 'white', marginLeft: '10px'}}>
            Terminate Game
          </button>
        </div>
      </div>
    );
  }
  
  // Show waiting room
  const playerCount = game ? getPlayerCount() : 0;
  const userInGame = game ? isUserInGame() : false;
  
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
              
              return (
                <div key={pos} className={`player-slot ${isMe ? 'current-user' : ''} ${playerId ? 'occupied' : 'empty'}`}>
                  <strong>{pos}:</strong> {playerName || 'Empty'}
                  {isMe && ' (You)'}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="game-actions">
        {game && !isUserInGame() && playerCount < 4 && (
          <button onClick={joinGame} className="join-game-btn">
            Join Game
          </button>
        )}
        
        {game && isUserInGame() && playerCount < 4 && (
          <div className="waiting-message">
            <p>Waiting for more players... ({playerCount}/4)</p>
            <small>Share this game ID with friends: <strong>{gameId}</strong></small>
          </div>
        )}
        
        {game && playerCount === 4 && game.status === 'waiting' && (
          <button onClick={startGame} className="start-game-btn">
            Start Game (All players ready!)
          </button>
        )}
        
        <button onClick={() => navigate('/lobby')} className="back-btn">
          Back to Lobby
        </button>
        
        {game && (
          <button onClick={loadGame} className="refresh-btn">
            Refresh Game
          </button>
        )}
        
        {game && isUserInGame() && (
          <button onClick={terminateGame} className="terminate-btn" style={{backgroundColor: '#dc3545', color: 'white', marginLeft: '10px'}}>
            Terminate Game
          </button>
        )}
      </div>
    </div>
  );
};

export default GameRoom;