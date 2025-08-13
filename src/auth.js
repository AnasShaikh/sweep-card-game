// src/auth.js - Authentication utilities
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'seep-game-jwt-secret-key';
const JWT_EXPIRES_IN = '7d';

// Hash password
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password with hash
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT token
export const generateToken = (userId, username) => {
  return jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Create new user
export const createUser = async (username, password) => {
  try {
    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Username already exists');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// Authenticate user
export const authenticateUser = async (username, password) => {
  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user = result.rows[0];
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    return {
      id: user.id,
      username: user.username
    };
  } catch (error) {
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT id, username, created_at FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
};

// JWT Middleware for Express
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Get full user data
  try {
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error during authentication' });
  }
};