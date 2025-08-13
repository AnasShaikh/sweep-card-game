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

  // Check token validity on app load
  useEffect(() => {
    const verifyStoredToken = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('auth_token');
      
      if (storedUser && storedToken) {
        try {
          const userData = JSON.parse(storedUser);
          console.log("Found stored user:", userData);
          
          // Verify token with server
          const response = await fetch('/api/verify', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const verifiedData = await response.json();
            console.log("Token verified successfully:", verifiedData);
            
            // Update stored user data with verified data
            const validatedUser = {
              id: verifiedData.user.id,
              username: verifiedData.user.username,
              token: storedToken
            };
            
            localStorage.setItem('user', JSON.stringify(validatedUser));
            setUser(validatedUser);
          } else {
            // Token is invalid, clear storage
            console.log("Token verification failed");
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
          }
        } catch (err) {
          console.error("Error verifying stored token:", err);
          localStorage.removeItem('user');
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };

    verifyStoredToken();
  }, []);

  const handleLogin = (userData) => {
    console.log("User logged in:", userData);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  // Create authenticated fetch function
  const authenticatedFetch = async (url, options = {}) => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // If we get a 401 or 403, the token might be expired
    if (response.status === 401 || response.status === 403) {
      console.log("Authentication failed, logging out");
      handleLogout();
      throw new Error('Authentication failed');
    }

    return response;
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
            element={user ? <Lobby user={user} authenticatedFetch={authenticatedFetch} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/game/:gameId" 
            element={user ? <GameRoom user={user} authenticatedFetch={authenticatedFetch} /> : <Navigate to="/" />} 
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