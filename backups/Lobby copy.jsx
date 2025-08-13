
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Lobby = ({ user }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games');
      const data = await response.json();
      setGames(data);
    } catch (err) {
      setError('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  const createGame = async () => {
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create game');
      }
      
      navigate(`/game/${data.gameId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const joinGame = (gameId) => {
    navigate(`/game/${gameId}`);
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
        <button onClick={createGame} className="create-game-btn">
          Create New Game
        </button>
        <button onClick={fetchGames} className="refresh-btn">
          Refresh Games
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="games-list">
        <h3>Available Games</h3>
        {games.length === 0 ? (
          <p>No games available. Create one to start playing!</p>
        ) : (
          games.map((game) => (
            <div key={game.id} className="game-item">
              <span>Created by: {game.creator}</span>
              <span>Players: {game.players}/{game.maxPlayers}</span>
              <button onClick={() => joinGame(game.id)}>
                Join Game
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Lobby;
