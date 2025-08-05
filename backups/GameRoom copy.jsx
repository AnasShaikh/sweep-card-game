import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Table from '../src/table';

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
        
        // Check if current user is already in the game and set their position
        if (user && user.id) {
          for (const [pos, playerId] of Object.entries(data.players)) {
            if (playerId === user.id) {
              setPosition(pos);
              console.log(`Found existing position: ${pos} for user ${user.id}`);
              break;
            }
          }
        }
      } catch (err) {
        setError(err.message);
      }
    };
    
    fetchGame();
    
    // Socket event listeners
    newSocket.on('gameUpdate', (updatedGame) => {
      console.log('Game update received:', updatedGame);
      setGame(updatedGame);
      
      // Update position if user joined
      if (user && user.id) {
        for (const [pos, playerId] of Object.entries(updatedGame.players)) {
          if (playerId === user.id) {
            setPosition(pos);
            break;
          }
        }
      }
    });
    
    newSocket.on('gameStarted', (startedGame) => {
      console.log('Game started event received:', startedGame);
      setGame(startedGame);
      
      // Make sure position is set correctly when game starts
      if (user && user.id) {
        for (const [pos, playerId] of Object.entries(startedGame.players)) {
          if (playerId === user.id) {
            setPosition(pos);
            break;
          }
        }
      }
    });
    
    newSocket.on('error', (errorMsg) => {
      console.error('Socket error:', errorMsg);
      setError(errorMsg);
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [gameId, user]);
  
  const joinPosition = (pos) => {
    // Check if position is already taken
    if (game.players[pos]) {
      return setError('Position already taken');
    }
    
    // Check if user is already in another position
    if (position) {
      return setError('You are already in the game');
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
    
    // Optimistically set position
    setPosition(pos);
  };
  
  const startGame = () => {
    if (!user || !user.id) {
      return setError('User not authenticated');
    }
    
    // Check if user is the creator
    if (user.id !== game.creator) {
      return setError('Only the game creator can start the game');
    }
    
    // Count actual players
    const playerCount = Object.values(game.players).filter(Boolean).length;
    console.log(`Starting game with ${playerCount} players`);
    
    if (playerCount < 2) {
      return setError('Need at least 2 players to start');
    }
    
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
    const playerCount = Object.values(game.players).filter(Boolean).length;
    const isCreator = user.id === game.creator;
    
    return (
      <div className="game-room">
        <h2>Game Room</h2>
        <div className="game-info">
          <p>Game ID: {gameId}</p>
          <p>Created by: {game.playerNames?.plyr1 || 'Unknown'}</p>
          <p>Players: {playerCount}/4</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="players-list">
          <h3>Players</h3>
          <div className="player-positions">
            {['plyr1', 'plyr2', 'plyr3', 'plyr4'].map((pos) => {
              const isOccupied = game.players[pos];
              const isMyPosition = position === pos;
              const playerName = game.playerNames?.[pos];
              
              return (
                <div key={pos} className="player-slot">
                  <span>
                    {pos}: {playerName || 'Open'}
                    {isMyPosition && ' (You)'}
                  </span>
                  {!isOccupied && !position && (
                    <button onClick={() => joinPosition(pos)}>
                      Take Seat
                    </button>
                  )}
                  {isOccupied && !isMyPosition && (
                    <span style={{color: 'green'}}>Occupied</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="game-actions">
          {isCreator && (
            <button 
              onClick={startGame}
              disabled={playerCount < 2}
              title={playerCount < 2 ? 'Need at least 2 players' : 'Start the game'}
            >
              Start Game ({playerCount}/4 players)
            </button>
          )}
          
          {!isCreator && playerCount < 4 && (
            <div className="waiting-message">
              Waiting for game creator to start the game...
            </div>
          )}
          
          {playerCount === 4 && !isCreator && (
            <div className="waiting-message">
              All players joined! Waiting for host to start...
            </div>
          )}
          
          <button onClick={backToLobby} className="back-btn">
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
        playerNames={game.playerNames || {}}
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