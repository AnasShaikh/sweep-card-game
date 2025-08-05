import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Table from './table';

const GameRoom = ({ user }) => {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      
      // Authenticate socket first
      newSocket.emit('authenticate', { userId: user.id, username: user.username });
      
      // Join the game room after authentication
      newSocket.emit('joinRoom', { gameId, userId: user.id });
      
      console.log(`User ${user.username} attempting to join room ${gameId}`);
    });
    
    // Define event handlers inside useEffect to avoid stale closures
    function handleGameUpdate(updatedGame) {
      console.log(`${user.username} received game update:`, updatedGame);
      // Use functional update to avoid stale closure
      setGame(prevGame => {
        console.log(`${user.username} updating from:`, prevGame, 'to:', updatedGame);
        return updatedGame;
      });
    }
    
    function handleGameStarted(startedGame) {
      console.log(`${user.username} received game started:`, startedGame);
      // Use functional update to avoid stale closure
      setGame(prevGame => {
        console.log(`${user.username} game started, updating from:`, prevGame, 'to:', startedGame);
        return startedGame;
      });
    }
    
    function handleError(errorMsg) {
      console.error('Socket error:', errorMsg);
      setError(errorMsg);
    }
    
    // Register event listeners
    newSocket.on('gameUpdate', handleGameUpdate);
    newSocket.on('gameStarted', handleGameStarted);
    newSocket.on('error', handleError);
    
    // Load initial game state
    loadGame();
    
    // Cleanup function
    return () => {
      newSocket.off('gameUpdate', handleGameUpdate);
      newSocket.off('gameStarted', handleGameStarted);
      newSocket.off('error', handleError);
      newSocket.disconnect();
    };
  }, [gameId, user.id, user.username]); // Only depend on values that won't change frequently
  
  const loadGame = async () => {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      console.log('Game loaded:', data);
      setGame(data);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const joinGame = () => {
    if (!game || !socket) return;
    
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
    if (!socket) return;
    
    socket.emit('startGame', {
      userId: user.id,
      gameId
    });
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
  
  if (!game) {
    return <div className="loading">Loading game...</div>;
  }
  
  // Show table if game is playing
  if (game.status === 'playing') {
    const userPosition = getUserPosition();
    
    if (!userPosition) {
      return (
        <div className="game-room">
          <h2>Game In Progress</h2>
          <p>This game has already started.</p>
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
        />
        <button onClick={() => navigate('/lobby')} className="back-btn">
          Back to Lobby
        </button>
      </div>
    );
  }
  
  // Show waiting room
  const playerCount = getPlayerCount();
  const userInGame = isUserInGame();
  
  return (
    <div className="game-room">
      <h2>Game Room</h2>
      <div className="game-info">
        <p>Game ID: {gameId}</p>
        <p>Players: {playerCount}/4</p>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="players-list">
        <h3>Players</h3>
        <div className="player-positions">
          {['plyr1', 'plyr2', 'plyr3', 'plyr4'].map((pos) => {
            const playerId = game.players[pos];
            const playerName = game.playerNames?.[pos];
            const isMe = playerId === user.id;
            
            return (
              <div key={pos} className="player-slot">
                <strong>{pos}:</strong> {playerName || 'Empty'}
                {isMe && ' (You)'}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="game-actions">
        {!isUserInGame() && playerCount < 4 && (
          <button onClick={joinGame}>
            Join Game
          </button>
        )}
        
        {isUserInGame() && playerCount < 4 && (
          <div className="waiting-message">
            Waiting for more players... ({playerCount}/4)
          </div>
        )}
        
        {playerCount === 4 && (
          <button onClick={startGame}>
            Start Game (All players ready!)
          </button>
        )}
        
        <button onClick={() => navigate('/lobby')} className="back-btn">
          Back to Lobby
        </button>
      </div>
    </div>
  );
};

export default GameRoom;