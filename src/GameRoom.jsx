
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Table from './table';

const GameRoom = ({ user }) => {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');
  const [position, setPosition] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    // Initialize socket connection
    const newSocket = io();
    
    // Authenticate socket with user data
    if (user && user.id) {
      newSocket.emit('authenticate', {
        userId: user.id,
        username: user.username
      });
      console.log(`Authenticating socket as ${user.username} (${user.id})`);
    } else {
      console.warn('Cannot authenticate socket - user or user ID missing');
    }
    
    setSocket(newSocket);
    
    // Fetch game details
    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load game');
        }
        
        setGame(data);
      } catch (err) {
        setError(err.message);
      }
    };
    
    fetchGame();
    
    // Socket event listeners
    newSocket.on('gameUpdate', (updatedGame) => {
      setGame(updatedGame);
    });
    
    newSocket.on('gameStarted', (startedGame) => {
      setGame(startedGame);
    });
    
    newSocket.on('error', (errorMsg) => {
      setError(errorMsg);
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [gameId]);
  
  const joinPosition = (pos) => {
    if (game.players[pos]) {
      return setError('Position already taken');
    }
    
    // Make sure we have a valid user
    if (!user || !user.id) {
      return setError('User not authenticated. Please log in again.');
    }
    
    console.log(`Joining game ${gameId} as ${user.username} (${user.id}) at position ${pos}`);
    socket.emit('joinGame', {
      userId: user.id,
      gameId,
      position: pos
    });
    
    setPosition(pos);
  };
  
  const startGame = () => {
    socket.emit('startGame', {
      userId: user.id,
      gameId
    });
  };
  
  const handleGameAction = (action, data) => {
    socket.emit('gameAction', {
      userId: user.id,
      gameId,
      action,
      data
    });
  };
  
  const backToLobby = () => {
    navigate('/lobby');
  };
  
  if (!game) {
    return <div className="loading">Loading game...</div>;
  }
  
  // If game is waiting for players
  if (game.status === 'waiting') {
    return (
      <div className="game-room">
        <h2>Game Room</h2>
        <div className="game-info">
          <p>Game ID: {gameId}</p>
          <p>Created by: {game.playerNames.plyr1}</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="players-list">
          <h3>Players</h3>
          <div className="player-positions">
            {['plyr1', 'plyr2', 'plyr3', 'plyr4'].map((pos) => (
              <div key={pos} className="player-slot">
                <span>{pos}: {game.playerNames[pos] || 'Open'}</span>
                {!game.players[pos] && !position && (
                  <button onClick={() => joinPosition(pos)}>
                    Take Seat
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="game-actions">
          {user.id === game.creator && Object.values(game.players).filter(Boolean).length < 4 && (
            <button 
              onClick={startGame}
              disabled={Object.values(game.players).filter(Boolean).length < 2}
            >
              Start Game
            </button>
          )}
          {Object.values(game.players).filter(Boolean).length === 4 && (
            <div className="waiting-message">
              All players joined! Game starting...
            </div>
          )}
          <button onClick={backToLobby}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }
  
  // If game is in progress
  return (
    <div className="game-room">
      <Table 
        gameId={gameId}
        user={user}
        position={position}
        playerNames={game.playerNames}
        socket={socket}
        onGameAction={handleGameAction}
        initialGameState={game.gameState}
      />
      <button onClick={backToLobby} className="back-btn">
        Back to Lobby
      </button>
    </div>
  );
};

export default GameRoom;
