import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Lobby = ({ user, authenticatedFetch }) => {
  const [games, setGames] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createGameLoading, setCreateGameLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/games');
      
      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }
      
      const data = await response.json();
      
      // Separate waiting games from active games
      const waitingGames = data.filter(game => game.status === 'waiting');
      const userActiveGames = data.filter(game => game.status === 'playing' && game.userRelation === 'participant');
      
      setGames(waitingGames);
      setActiveGames(userActiveGames);
      setError('');
    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createGame = async () => {
    try {
      setCreateGameLoading(true);
      setError('');
      
      const response = await authenticatedFetch('/api/games', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create game');
      }
      
      const data = await response.json();
      console.log('Game created successfully:', data);
      
      navigate(`/game/${data.gameId}`);
    } catch (err) {
      console.error('Error creating game:', err);
      setError(err.message);
    } finally {
      setCreateGameLoading(false);
    }
  };

  const joinGame = (gameId) => {
    navigate(`/game/${gameId}`);
  };


  const resumeGame = (gameId) => {
    navigate(`/game/${gameId}`);
  };

  const refreshGames = async () => {
    setError('');
    await fetchGames();
  };

  if (loading) {
    return <div className="loading">Loading games...</div>;
  }

  return (
    <div className="lobby-container">
      <h2>Game Lobby</h2>
      <div className="lobby-welcome">
        Welcome, {user.username}!
      </div>
      
      <div className="lobby-actions">
        <button 
          onClick={createGame} 
          className="create-game-btn"
          disabled={createGameLoading}
        >
          {createGameLoading ? 'Creating Game...' : 'Create New Game'}
        </button>
        <button 
          onClick={refreshGames} 
          className="refresh-btn"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Games'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
          {error.includes('Authentication failed') && (
            <p>Please log in again to continue.</p>
          )}
        </div>
      )}
      
      {/* Your Active Games Section */}
      {activeGames.length > 0 && (
        <div className="active-games-list">
          <h3>Your Active Games</h3>
          <div className="games-grid">
            {activeGames.map((game) => (
              <div key={game.id} className="game-item active-game">
                <div className="game-info">
                  <div className="game-creator">
                    <strong>Created by:</strong> {game.creator}
                  </div>
                  <div className="game-players">
                    <strong>Players:</strong> {game.players}/{game.maxPlayers}
                  </div>
                  <div className="game-status">
                    <strong>Status:</strong> Playing
                  </div>
                </div>
                <div className="game-actions">
                  <button 
                    onClick={() => resumeGame(game.id)}
                    className="resume-game-btn"
                  >
                    Resume Game
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="games-list">
        <h3>Available Games</h3>
        {games.length === 0 ? (
          <div className="no-games">
            <p>No games available. Create one to start playing!</p>
          </div>
        ) : (
          <div className="games-grid">
            {games.map((game) => (
              <div key={game.id} className="game-item">
                <div className="game-info">
                  <div className="game-creator">
                    <strong>Created by:</strong> {game.creator}
                  </div>
                  <div className="game-players">
                    <strong>Players:</strong> {game.players}/{game.maxPlayers}
                  </div>
                  <div className="game-status">
                    <strong>Status:</strong> {game.status || 'Waiting'}
                  </div>
                </div>
                <div className="game-actions">
                  <button 
                    onClick={() => joinGame(game.id)}
                    className="join-game-btn"
                    disabled={game.players >= game.maxPlayers}
                  >
                    {game.players >= game.maxPlayers ? 'Game Full' : 'Join Game'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="lobby-stats">
        <p>Total available games: {games.length}</p>
        <p>Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default Lobby;