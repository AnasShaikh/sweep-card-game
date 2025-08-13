# Seep Card Game - File Overview

## Frontend Files

### `index.html`
Basic HTML entry point for the React application. Sets up the root div and loads the main React bundle.

### `src/index.jsx`
React application entry point that renders the main App component in React StrictMode.

### `src/App.jsx`
Main application component with routing and JWT authentication state management.
- `handleLogin()` - Sets user data after successful authentication
- `handleLogout()` - Clears user data, JWT token, and localStorage
- `authenticatedFetch()` - Helper function for API calls with JWT headers
- Token verification on app startup with auto-logout on invalid tokens

### `src/App.css`
Complete stylesheet for the entire application including:
- Layout styles for main, header, user-info sections
- Login/registration page styles (login-container, form-group, auth-toggle, etc.)
- Lobby page styles (lobby-actions, games-list, etc.)
- Game room styles (player-positions, game-actions, etc.)
- Table/game styles (playTable, playerArea, cardDivBoard, etc.)
- Card display styles (handCard, stackCard, collectedCard, etc.)
- Button and control styles

### `src/Login.jsx`
User authentication component with registration and login functionality.
- `handleSubmit()` - Processes login/register form with password validation
- `toggleMode()` - Switches between login and registration forms
- `validateForm()` - Client-side validation for username/password requirements
- Password fields, confirmation fields, and form validation

### `src/Lobby.jsx`
Game lobby interface for creating and joining games with JWT authentication.
- `fetchGames()` - Retrieves list of available games using authenticatedFetch
- `createGame()` - Creates new game with JWT auth and navigates to game room
- `joinGame()` - Navigates to specified game room
- All API calls protected with JWT authentication

### `src/GameRoom.jsx`
Game waiting room and coordinator component with JWT socket authentication.
- `loadGame()` - Fetches initial game state from server with JWT auth
- `joinGame()` - Joins player to available position
- `startGame()` - Initiates game when 4 players present
- `getUserPosition()` - Finds current user's player position
- `isUserInGame()` - Checks if user is already in game
- `getPlayerCount()` - Counts current players in game
- `canStartGame()` - Validates if game can start (4 players)
- Socket authentication with JWT token verification

### `src/table.jsx`
Main game table component managing game state and player interactions.
- `dealCards()` - Initial card distribution (4 cards each + 4 to board)
- `dealRemainingCards()` - Deals remaining deck (8 cards each)
- `handleCall()` - Processes player's call selection
- `handleHandCardSelection()` - Manages single hand card selection
- `handleTableCardSelection()` - Manages table card selection
- `handleExistingStackSelection()` - Manages stack selection for adding
- `handleConfirmStack()` - Creates new stack from selected cards
- `handleConfirmAddToStack()` - Adds cards to existing stack
- `handlePerformPickup()` - Executes pickup action with selected cards
- `handlePickupAction()` - Validates and initiates pickup
- `handleThrowAwayAction()` - Executes throw away action

### `src/TableUI.jsx`
Pure UI component for rendering the game table interface.
- `getCreatorDisplayName()` - Formats stack creator name with team info
- `renderBoardCards()` - Renders board cards including stacks with interaction
- `renderHandCards()` - Renders current player's hand cards
- Component renders all player areas, scores, controls, and game state

### `src/tableLogic.js`
Core game logic and utility functions.
- `getTeam()` - Determines team (1 or 2) from player position
- `isTeammate()` - Checks if two players are on same team
- `isOpponent()` - Checks if two players are opponents
- `getStackValue()` - Extracts numeric value from stack string
- `getStackTotalPoints()` - Calculates total card points in stack
- `getStackCardCount()` - Counts total cards in stack
- `isLooseStack()` - Determines if stack can be modified (not tight)
- `getStackCreator()` - Extracts creator player from stack string
- `canAddToStack()` - Validates if player can add to specific stack
- `canModifyStackValue()` - Checks if stack value can be modified
- `findAllPickupCombinations()` - Auto-expands pickup to include all valid cards
- `findAllStackCombinations()` - Auto-expands stack creation to include all valid cards
- `getAllCombinations()` - Generates all possible card combinations
- `shuffleDeck()` - Randomizes deck order
- `formatCardName()` - Converts card name to filename format
- `getCardValue()` - Returns numeric value of card (Ace=1, Jack=11, etc.)
- `nextPlayer()` - Determines next player in turn order
- `calculatePoints()` - Calculates scoring points from collected cards
- `checkValidCalls()` - Returns valid call values (9-13) from hand

### `src/tableActions.js`
Game action handlers and validation logic.
- `confirmStack()` - Validates and creates new stacks with auto-expansion
- `confirmAddToStack()` - Handles adding cards to existing stacks (stacking vs modification)
- `handlePickup()` - Validates pickup action and triggers auto-expansion
- `performPickup()` - Executes pickup, updates collections, handles seep scoring
- `handleThrowAway()` - Validates and executes throw away action
- `handleEndOfRound()` - Assigns remaining board cards to last collector

### `src/initialDeck.js`
Static deck definition.
- `initialDeck` - Complete 52-card deck array

### `src/auth.js` ✨ **NEW**
Authentication utilities for JWT-based user management.
- `hashPassword()` - Hash password with bcrypt (12 salt rounds)
- `comparePassword()` - Verify password against hash
- `generateToken()` - Create JWT token with 7-day expiration
- `verifyToken()` - Validate JWT token
- `authenticateToken()` - Express middleware for protected routes
- `createUser()` - Register new user in database
- `authenticateUser()` - Login user with password verification
- `getUserById()` - Fetch user data from database

### `src/db.js`
PostgreSQL database connection and configuration.
- Database pool connection to `seep_game` database
- Connection error handling and logging

## Backend Files

### `server.js`
Express server with Socket.IO for real-time multiplayer functionality and JWT authentication.

**Authentication Routes:**
- `POST /api/register` - User registration with password hashing
- `POST /api/login` - User authentication with JWT token response
- `GET /api/verify` - JWT token validation endpoint

**Protected Game Routes (JWT Required):**
- `POST /api/games` - Game creation with database storage
- `GET /api/games` - List available games from database
- `GET /api/games/:gameId` - Get specific game details from database

**Socket.IO Events (JWT Authentication):**
- `authenticate` - Associates socket with user via JWT token
- `joinRoom` - Joins socket to game room
- `joinGame` - Adds player to specific position in game
- `startGame` - Initiates game when 4 players ready
- `gameAction` - Handles all game actions (deals, moves, calls)

**Data Storage:**
- PostgreSQL database for persistent user and game storage
- In-memory game state for Socket.IO compatibility during transition

### `.env` ✨ **NEW**
Environment variables for configuration.
- `JWT_SECRET` - Secret key for JWT token signing
- `SESSION_SECRET` - Secret key for session encryption
- Database connection parameters (host, port, name, user, password)
- Server configuration (port, environment)

## Database Schema ✨ **NEW**

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

## Key Game Features

**JWT Authentication:** Secure user registration and login with password hashing

**Persistent Storage:** PostgreSQL database for users and games

**Protected APIs:** All game endpoints require JWT authentication

**Multiplayer Support:** Real-time 4-player games with Socket.IO synchronization

**Team Play:** Players 1&3 vs Players 2&4 with team-specific permissions

**Stack System:** Complex stack creation and modification with loose/tight mechanics

**Auto-Expansion:** Automatic inclusion of valid cards during pickup and stack creation

**Seep Scoring:** Special scoring for clearing the board (50 points, max 2 per team)

**Turn Management:** Structured turn-based gameplay with call system

**Card Validation:** Comprehensive validation for all game actions

## Authentication Flow ✨ **NEW**

### **Registration/Login Process**
1. User enters username/password in Login.jsx
2. Frontend sends credentials to `/api/register` or `/api/login`
3. Server validates credentials and generates JWT token
4. JWT token stored in localStorage for API authentication
5. All subsequent API calls include `Authorization: Bearer <token>` header

### **Socket Authentication**
1. Client connects to Socket.IO with JWT token
2. Server verifies token and associates socket with user
3. All game actions require authenticated socket connection

## File Interdependencies & Relationships

### Core Application Flow
```
index.html → src/index.jsx → src/App.jsx
```
- **index.html** provides the DOM mount point for React
- **src/index.jsx** bootstraps React and renders App component
- **src/App.jsx** manages routing and JWT authentication state

### Authentication & Navigation Chain ✨ **UPDATED**
```
src/App.jsx ↔ src/Login.jsx ↔ src/Lobby.jsx ↔ src/GameRoom.jsx ↔ src/table.jsx
                ↓
            src/auth.js ↔ server.js ↔ PostgreSQL Database
```
- **src/App.jsx** routes between Login/Lobby/GameRoom based on JWT auth state
- **src/Login.jsx** handles registration/login with password validation
- **src/auth.js** provides authentication utilities for password hashing and JWT
- **server.js** validates credentials and manages JWT tokens
- **PostgreSQL Database** stores user accounts and game data

### Game Logic Architecture
```
src/table.jsx → src/TableUI.jsx → src/tableLogic.js
src/table.jsx → src/tableActions.js → src/tableLogic.js
```
- **src/table.jsx** orchestrates game state and delegates to TableUI for rendering
- **src/TableUI.jsx** is pure presentation layer, calls event handlers from table.jsx
- **src/tableActions.js** contains complex action logic, imports utilities from tableLogic.js
- **src/tableLogic.js** provides core utilities used by both table.jsx and tableActions.js

### Data Flow Dependencies ✨ **UPDATED**
```
src/initialDeck.js → src/table.jsx → src/tableActions.js → src/tableLogic.js
PostgreSQL Database ↔ server.js ↔ src/GameRoom.jsx
```
- **src/initialDeck.js** provides static deck data imported by table.jsx
- **PostgreSQL Database** stores persistent user and game data
- **server.js** manages database operations and JWT authentication
- **src/GameRoom.jsx** fetches game data from database via authenticated APIs

### Client-Server Communication ✨ **UPDATED**
```
src/GameRoom.jsx ↔ server.js ↔ src/table.jsx
        ↓              ↓
    JWT Auth    PostgreSQL DB
```
- **src/GameRoom.jsx** establishes authenticated Socket.IO connection
- **server.js** manages JWT verification and database synchronization
- **src/table.jsx** receives real-time updates via authenticated Socket.IO
- All API calls require JWT authentication headers

### Authentication Dependencies ✨ **NEW**
```
src/Login.jsx → src/auth.js → server.js → PostgreSQL Database
     ↓              ↓            ↓
JWT Storage → API Headers → Token Validation
```
- **src/Login.jsx** collects credentials and stores JWT tokens
- **src/auth.js** handles password hashing and JWT operations
- **server.js** validates tokens and protects API endpoints
- **PostgreSQL Database** stores hashed passwords and user data

### Styling Dependencies
```
src/App.css → [ALL React Components]
```
- **src/App.css** contains styles for all components including new auth styles
- Every React component relies on CSS classes defined in App.css
- Components reference specific CSS classes (e.g., `.playTable`, `.login-container`, `.auth-toggle`)

### Key Interdependency Patterns

**JWT Authentication Flow:**
- `src/auth.js` provides utilities used by `server.js` for user management
- `src/App.jsx` manages JWT token lifecycle and authenticated requests
- `src/Login.jsx` handles credential collection and token storage
- All protected components receive `authenticatedFetch` for API calls

**Database Integration:**
- `src/db.js` provides PostgreSQL connection used by `server.js`
- `src/auth.js` functions query database for user operations
- `server.js` stores game state in database instead of memory
- Real-time Socket.IO updates synchronized with database state

**State Management Flow:**
- `table.jsx` maintains master game state
- `TableUI.jsx` receives state as props, sends events back via callbacks
- `tableActions.js` functions modify state and return new state objects
- `tableLogic.js` provides pure utility functions for calculations

**Socket Communication Pattern:**
- `GameRoom.jsx` establishes JWT-authenticated Socket.IO connection
- `table.jsx` emits game actions via `onGameAction` callback to GameRoom
- `GameRoom.jsx` forwards actions to `server.js` via Socket.IO
- `server.js` broadcasts updates to all authenticated clients

**Import Hierarchy:**
```
tableLogic.js (bottom layer - pure utilities)
    ↑
tableActions.js (business logic layer)
    ↑
table.jsx (state management layer)
    ↑
TableUI.jsx (presentation layer)

auth.js (authentication utilities)
    ↑
server.js (API and socket layer)
    ↑
App.jsx (application state management)
```

**Cross-Component Data Sharing:**
- User data flows from App.jsx → Lobby.jsx → GameRoom.jsx → table.jsx
- JWT tokens flow from Login.jsx → App.jsx → all protected components
- Game state flows from PostgreSQL → server.js → GameRoom.jsx → table.jsx → TableUI.jsx
- Player actions flow from TableUI.jsx → table.jsx → GameRoom.jsx → server.js → PostgreSQL

**Critical Dependencies:**
- `table.jsx` **CANNOT** function without `tableLogic.js` and `tableActions.js`
- `TableUI.jsx` **REQUIRES** event handlers from `table.jsx` to be interactive
- `GameRoom.jsx` **NEEDS** JWT-authenticated Socket.IO connection to synchronize
- `server.js` **DEPENDS** on `src/auth.js` for authentication utilities
- All protected routes **REQUIRE** valid JWT tokens for access
- All components **DEPEND** on `App.css` for proper visual rendering