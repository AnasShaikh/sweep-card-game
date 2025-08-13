import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    
    if (formData.username.trim().length < 2) {
      setError('Username must be at least 2 characters long');
      return false;
    }

    if (!formData.password) {
      setError('Password is required');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (isRegistering) {
      if (!formData.confirmPassword) {
        setError('Please confirm your password');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const endpoint = isRegistering ? '/api/register' : '/api/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `${isRegistering ? 'Registration' : 'Login'} failed`);
      }

      console.log(`${isRegistering ? 'Registration' : 'Login'} successful:`, data);

      // Store user data and token
      const userData = {
        id: data.user.id,
        username: data.user.username,
        token: data.token
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('auth_token', data.token);
      
      onLogin(userData);
    } catch (err) {
      console.error(`${isRegistering ? 'Registration' : 'Login'} error:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setFormData({
      username: '',
      password: '',
      confirmPassword: ''
    });
  };

  return (
    <div className="login-container">
      <h2>
        {isRegistering ? 'Create Account' : 'Welcome to Seep Card Game'}
      </h2>
      
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Enter your username"
            required
            minLength="2"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter your password"
            required
            minLength="6"
          />
        </div>

        {isRegistering && (
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              required
              minLength="6"
            />
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 
            (isRegistering ? 'Creating Account...' : 'Logging in...') :
            (isRegistering ? 'Create Account' : 'Login')
          }
        </button>
      </form>

      <div className="auth-toggle">
        <p>
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}
          <button 
            type="button" 
            onClick={toggleMode}
            className="toggle-btn"
            disabled={loading}
          >
            {isRegistering ? 'Login' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;