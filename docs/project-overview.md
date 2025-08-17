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

### `src/styles/table.css` ✨ **UPDATED**
Complete stylesheet for the game table and components including:
- Desktop layout styles with CSS Grid (playTable, playerArea, board positioning)
- Mobile responsive design with flex layouts and media queries
- Card display styles (handCard, stackCard, tableCard, collectedCard, etc.)
- Stack interaction styles with animations (selected, can-add, hover effects)
- Timer system styles with color-coded progress bars and warning animations
- Button and control styles for game actions
- Animation keyframes for card dealing, pulses, and timer warnings

### `src/App.css`
Application-wide stylesheet including:
- Layout styles for main, header, user-info sections
- Login/registration page styles (login-container, form-group, auth-toggle, etc.)
- Lobby page styles (lobby-actions, games-list, etc.)
- Game room styles (player-positions, game-actions, etc.)
- General button and control styles

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
- `handleTimerStart()` - Manages timer activation for player turns
- `handleTimerStop()` - Handles timer deactivation on moves
- Timer state management with 30-second countdown and auto-stop on actions

### `src/TableUI.jsx`
Pure UI component for rendering the game table interface.
- `getCreatorDisplayName()` - Formats stack creator name with team info
- `renderBoardCards()` - Renders board cards including stacks with interaction
- `renderHandCards()` - Renders current player's hand cards
- `renderMobileLayout()` - Mobile-optimized layout with responsive design
- `renderDesktopLayout()` - Desktop layout with CSS grid positioning
- `renderControls()` - Action buttons and game controls
- Component renders all player areas, scores, controls, game state, and timer display

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

### `src/components/TimerDisplay.jsx` ✨ **NEW**
Visual countdown timer component for player move timeouts.
- `getPlayerDisplayName()` - Formats player name for timer display
- `getTimerColor()` - Color-codes progress bar (green → yellow → red)
- `getTimerClass()` - Applies CSS classes for warning states
- Progress bar with 30-second countdown and percentage calculation
- Warning animations at 10s and 5s remaining
- Responsive design for both mobile and desktop layouts

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



### `src/botAI.js` ✨ **NEW**
Dedicated bot artificial intelligence module for strategic gameplay.
- `canBotPickup()` - Detects pickup opportunities including seep detection
- `canBotCreateStack()` - Identifies stack creation opportunities with game rule validation
- `generateBotMove()` - Main decision engine implementing priority system (seeps > stacks > pickups > throwaway)
- `createPickupAction()` - Helper to construct pickup actions with seep scoring
- `createStackAction()` - Helper to construct stack creation actions
- `createThrowAwayAction()` - Helper to construct fallback throwaway actions  
- `getBotMoveDelay()` - Configurable timing for realistic bot behavior
- **Security:** All bot logic runs server-side to prevent cheating
- **Priority System:** Bots prioritize seeps (50pts), then stacks, then regular pickups

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
- `POST /api/games/:gameId/fill-bots` - Fill remaining slots with AI bots

**Socket.IO Events (JWT Authentication):**
- `authenticate` - Associates socket with user via JWT token
- `joinRoom` - Joins socket to game room
- `joinGame` - Adds player to specific position in game
- `startGame` - Initiates game when 4 players ready
- `gameAction` - Handles all game actions (deals, moves, calls)
- `terminateGame` - Allows players to end active games
- `gameFinished` - Marks completed games in database
- `timerStart` - Broadcasts timer activation to all players
- `timerStop` - Broadcasts timer deactivation to all players

**Timer Management System:** ✨ **NEW**
- `startMoveTimer()` - Creates 30-second timeout for human players only
- `clearMoveTimer()` - Stops active timer and broadcasts to clients
- `executeAutoMove()` - Automatically throws random card on timeout
- Server-side timer validation to prevent cheating
- Automatic timer clearing on any player action

**Bot Integration:**
- Imports `generateBotMove()` from `src/botAI.js` for AI decision making
- Automatic bot move triggering with 1-3 second realistic delays  
- Bot move execution and state synchronization
- Bots bypass timer system (no timeouts for AI players)

**Data Storage:**
- PostgreSQL database for persistent user and game storage
- In-memory game state for Socket.IO compatibility during transition
- Game status tracking ('waiting', 'playing', 'finished', 'terminated')

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

**AI Bot Players:** Intelligent bots with strategic decision making and rule compliance

**Move Timer System:** ✨ **NEW** 30-second countdown timers with automatic card throwing on timeout

**Team Play:** Players 1&3 vs Players 2&4 with team-specific permissions

**Stack System:** Complex stack creation and modification with loose/tight mechanics

**Auto-Expansion:** Automatic inclusion of valid cards during pickup and stack creation

**Seep Scoring:** Special scoring for clearing the board (50 points, max 2 per team)

**Turn Management:** Structured turn-based gameplay with call system

**Card Validation:** Comprehensive validation for all game actions

**Game End Detection:** Automatic winner determination and database status updates

**Responsive Design:** Mobile and desktop optimized layouts with touch-friendly controls

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

## Timer System Flow ✨ **NEW**

### **Move Timer Process**
1. Human player's turn begins - server starts 30-second timer
2. Server broadcasts `timerStart` event to all clients with countdown
3. Client displays visual countdown with color-coded progress bar
4. If player makes move - timer immediately stops and disappears
5. If timeout occurs - server automatically throws random card
6. Auto-thrown card triggers normal game flow and next player's timer

### **Timer States & Visual Feedback**
- **Green (30-21s):** Normal time remaining
- **Yellow (20-11s):** Warning state with pulse animation
- **Red (10-1s):** Critical state with urgent animations
- **Hidden:** No timer for bot players (they move automatically)

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

### Game Logic Architecture ✨ **UPDATED**
```
src/table.jsx → src/TableUI.jsx → src/components/TimerDisplay.jsx
src/table.jsx → src/tableActions.js → src/tableLogic.js
server.js → src/tableActions.js (for auto-move execution)
```
- **src/table.jsx** orchestrates game state, timer state, and delegates to TableUI for rendering
- **src/TableUI.jsx** is pure presentation layer, integrates TimerDisplay component
- **src/components/TimerDisplay.jsx** provides visual timer countdown with progress bars
- **src/tableActions.js** contains complex action logic, imports utilities from tableLogic.js
- **src/tableLogic.js** provides core utilities used by table.jsx, tableActions.js, and server.js
- **server.js** imports tableActions.js for executing automatic moves on timeouts

### Data Flow Dependencies ✨ **UPDATED**
```
src/initialDeck.js → src/table.jsx → src/tableActions.js → src/tableLogic.js
PostgreSQL Database ↔ server.js ↔ src/GameRoom.jsx
src/botAI.js → server.js (bot decision making)
```
- **src/initialDeck.js** provides static deck data imported by table.jsx
- **PostgreSQL Database** stores persistent user and game data
- **server.js** manages database operations and JWT authentication
- **src/GameRoom.jsx** fetches game data from database via authenticated APIs
- **src/botAI.js** provides AI decision making imported by server.js for bot players

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

### Styling Dependencies ✨ **UPDATED**
```
src/App.css → [Login, Lobby, GameRoom Components]
src/styles/table.css → [Table, TableUI, TimerDisplay Components]
```
- **src/App.css** contains application-wide styles for auth and navigation components
- **src/styles/table.css** contains game-specific styles including timer animations
- Table components rely on CSS classes for responsive layouts and visual feedback
- Timer component uses specialized CSS classes (e.g., `.timer-container`, `.timer-warning`, `.timer-critical`)

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

tableLogic.js → botAI.js (AI decision making)
    ↑
auth.js (authentication utilities) → server.js (API and socket layer)
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
- `TableUI.jsx` **IMPORTS** `TimerDisplay.jsx` for timer visualization
- `GameRoom.jsx` **NEEDS** JWT-authenticated Socket.IO connection to synchronize
- `server.js` **DEPENDS** on `src/auth.js` for authentication utilities
- `server.js` **IMPORTS** `src/botAI.js` for AI bot decision making
- `server.js` **IMPORTS** `src/tableActions.js` for auto-move execution on timeouts
- `src/botAI.js` **REQUIRES** `src/tableLogic.js` for game utilities and card values
- `TimerDisplay.jsx` **DEPENDS** on `src/styles/table.css` for animations and styling
- All protected routes **REQUIRE** valid JWT tokens for access
- Table components **DEPEND** on `src/styles/table.css` for responsive layouts
- Timer system **NEEDS** server-side validation to prevent timeout manipulation
- Bot functionality **NEEDS** server-side execution to prevent cheating