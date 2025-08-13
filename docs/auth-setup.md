# 🔐 Authentication System Reference

## 📋 **Overview**
JWT-based authentication system for Seep card game. Migrated from username-only to password-based authentication with PostgreSQL storage.

---

## 🏗️ **Architecture**

### **Authentication Flow**
1. **Registration**: User creates account → Password hashed → Stored in PostgreSQL → JWT token issued
2. **Login**: User enters credentials → Password verified → JWT token issued → Token stored in localStorage
3. **API Requests**: All protected routes require `Authorization: Bearer <token>` header
4. **Socket Connections**: JWT token verified for real-time game communication

### **Security Features**
- Password hashing: bcrypt with 12 salt rounds
- JWT tokens: 7-day expiration
- Protected routes: All game APIs require authentication
- Auto-logout: Invalid/expired tokens trigger logout

---

## 📁 **File Changes**

```
├── src/
│   ├── auth.js           ← NEW: Authentication utilities
│   ├── App.jsx           ← UPDATED: JWT token management
│   ├── Login.jsx         ← UPDATED: Registration + login form
│   ├── Lobby.jsx         ← UPDATED: Authenticated API calls
│   ├── GameRoom.jsx      ← UPDATED: JWT socket auth
├── server.js             ← UPDATED: JWT routes, protected endpoints
├── .env                  ← NEW: Environment variables
└── .gitignore            ← UPDATED: Added .env
```

---

## 🗄️ **Database Schema**

### **Users Table**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Games Table**
```sql
CREATE TABLE games (
    id VARCHAR(36) PRIMARY KEY,           -- UUID
    creator_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'waiting',
    players JSONB,                        -- Player positions
    player_names JSONB,                   -- Player usernames
    game_state JSONB,                     -- Game data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔧 **Core Components**

### **Authentication Utilities (`src/auth.js`)**
```javascript
hashPassword(password)              // Hash password with bcrypt
comparePassword(password, hash)     // Verify password
generateToken(userId, username)     // Create JWT token
verifyToken(token)                  // Validate JWT token
authenticateToken(req, res, next)   // Express middleware
createUser(username, password)      // Register new user
authenticateUser(username, password) // Login user
```

### **API Routes (`server.js`)**
```javascript
// Authentication routes:
POST /api/register    // Create new user account
POST /api/login       // User login with JWT response
GET  /api/verify      // Verify JWT token validity

// Protected game routes (require JWT):
POST /api/games       // Create new game
GET  /api/games       // List available games
GET  /api/games/:id   // Get specific game
```

### **Frontend (`App.jsx`)**
- Token verification on app startup
- `authenticatedFetch()` helper function
- Automatic logout on auth failures
- localStorage token management

---

## ⚙️ **Configuration**

### **Environment Variables (`.env`)**
```bash
JWT_SECRET=seep-game-jwt-secret-abc123def456ghi789jkl012mno345pqr678
SESSION_SECRET=seep-game-session-secret-xyz987wvu654tsr321qpo098nml765
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seep_game
DB_USER=seep_user
DB_PASSWORD=seep_password
PORT=3000
NODE_ENV=development
```

### **Security Settings**
```javascript
const JWT_EXPIRES_IN = '7d';        // Token lifetime
const saltRounds = 12;              // Password hashing strength

// Password Requirements:
// - Minimum 6 characters
// - Username minimum 2 characters
// - Username must be unique
```

---

## 🔌 **API Examples**

### **Register User**
```http
POST /api/register
Content-Type: application/json

{
  "username": "player1",
  "password": "securepass123"
}
```

### **Login User**
```http
POST /api/login
Content-Type: application/json

{
  "username": "player1",
  "password": "securepass123"
}
```

### **Protected Routes**
```http
GET /api/games
Authorization: Bearer <jwt_token>
```

---

## 🌐 **Socket Authentication**

### **Client**
```javascript
socket.emit('authenticate', { 
  token: localStorage.getItem('auth_token'),
  userId: user.id, 
  username: user.username 
});
```

### **Server**
```javascript
socket.on('authenticate', async (userData) => {
  if (userData?.token) {
    const decoded = verifyToken(userData.token);
    const user = await getUserById(decoded.userId);
    socket.userId = user.id;
    socket.username = user.username;
  }
});
```

---

## 📦 **Dependencies**

```json
{
  "bcryptjs": "^2.4.3",      // Password hashing
  "jsonwebtoken": "^9.0.0",  // JWT token handling
  "pg": "^8.8.0",            // PostgreSQL client
  "express-session": "^1.17.3" // Session management
}
```

---

## 🔄 **Migration Notes**

**Before**: Simple username login with in-memory game storage
**After**: Password-based JWT auth with PostgreSQL storage

**Key Changes**:
- All API routes now protected with JWT middleware
- Games stored in database with user relationships
- Socket connections require token verification
- Frontend handles token management and auto-logout