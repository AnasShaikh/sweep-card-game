import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './Login';
import Lobby from './Lobby';
import GameRoom from './GameRoom';
import Table from './table';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for existing user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        console.log("Loaded user from localStorage:", userData);
        
        // Ensure the user object has the correct structure (id and username)
        const validatedUser = {
          id: userData.id || userData.userId,
          username: userData.username
        };
        
        setUser(validatedUser);
      } catch (err) {
        console.error("Error parsing stored user data:", err);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <main>
        <div className="header">
          <h1>Seep Saap Soop</h1>
          {user && (
            <div className="user-info">
              <span>Welcome, {user.username}!</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          )}
        </div>

        <Routes>
          <Route 
            path="/" 
            element={user ? <Navigate to="/lobby" /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/lobby" 
            element={user ? <Lobby user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/game/:gameId" 
            element={user ? <GameRoom user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/play" 
            element={user ? <Table /> : <Navigate to="/" />} 
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}