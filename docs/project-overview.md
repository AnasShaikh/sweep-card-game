# Seep Card Game - File Overview

## Frontend Files

### `index.html`
Basic HTML entry point for the React application. Sets up the root div and loads the main React bundle.

### `src/index.jsx`
React application entry point that renders the main App component in React StrictMode.

### `src/App.jsx`
Main application component with routing and authentication state management.
- `handleLogin()` - Sets user data after successful login
- `handleLogout()` - Clears user data and localStorage

### `src/App.css`
Complete stylesheet for the entire application including:
- Layout styles for main, header, user-info sections
- Login page styles (login-container, form-group, etc.)
- Lobby page styles (lobby-actions, games-list, etc.)
- Game room styles (player-positions, game-actions, etc.)
- Table/game styles (playTable, playerArea, cardDivBoard, etc.)
- Card display styles (handCard, stackCard, collectedCard, etc.)
- Button and control styles

### `src/Login.jsx`
User authentication component for entering username.
- `handleSubmit()` - Processes login form submission and stores user data

### `src/Lobby.jsx`
Game lobby interface for creating and joining games.
- `fetchGames()` - Retrieves list of available games
- `createGame()` - Creates new game and navigates to game room
- `joinGame()` - Navigates to specified game room

### `src/GameRoom.jsx`
Game waiting room and coordinator component.
- `loadGame()` - Fetches initial game state from server
- `joinGame()` - Joins player to available position
- `startGame()` - Initiates game when 4 players present
- `getUserPosition()` - Finds current user's player position
- `isUserInGame()` - Checks if user is already in game
- `getPlayerCount()` - Counts current players in game
- `canStartGame()` - Validates if game can start (4 players)

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

### `src/initialDeck.js`
Static deck definition.
- `initialDeck` - Complete 52-card deck array

## Backend Files

### `server.js`
Express server with Socket.IO for real-time multiplayer functionality.

**HTTP Routes:**
- `POST /api/login` - User authentication and session creation
- `POST /api/games` - Game creation (creator auto-joins as plyr1)
- `GET /api/games` - List available games
- `GET /api/games/:gameId` - Get specific game details
- `GET *` - Serve React app for all other routes

**Socket.IO Events:**
- `authenticate` - Associates socket with user
- `joinRoom` - Joins socket to game room
- `joinGame` - Adds player to specific position in game
- `startGame` - Initiates game when 4 players ready
- `gameAction` - Handles all game actions (deals, moves, calls)

**Data Storage:**
- `users{}` - In-memory user storage with sessions
- `games{}` - In-memory game state storage

## Key Game Features

**Multiplayer Support:** Real-time 4-player games with Socket.IO synchronization

**Team Play:** Players 1&3 vs Players 2&4 with team-specific permissions

**Stack System:** Complex stack creation and modification with loose/tight mechanics

**Auto-Expansion:** Automatic inclusion of valid cards during pickup and stack creation

**Seep Scoring:** Special scoring for clearing the board (50 points, max 2 per team)

**Turn Management:** Structured turn-based gameplay with call system

**Card Validation:** Comprehensive validation for all game actions

## File Interdependencies & Relationships

### Core Application Flow
```
index.html → src/index.jsx → src/App.jsx
```
- **index.html** provides the DOM mount point for React
- **src/index.jsx** bootstraps React and renders App component
- **src/App.jsx** manages routing and user authentication state

### Authentication & Navigation Chain
```
src/App.jsx ↔ src/Login.jsx ↔ src/Lobby.jsx ↔ src/GameRoom.jsx ↔ src/table.jsx
```
- **src/App.jsx** routes between Login/Lobby/GameRoom based on auth state
- **src/Login.jsx** sends user data back to App.jsx via `onLogin` callback
- **src/Lobby.jsx** receives user prop from App.jsx, navigates to GameRoom
- **src/GameRoom.jsx** receives user prop, manages game joining, renders Table when game starts
- **src/table.jsx** receives game props from GameRoom, manages actual gameplay

### Game Logic Architecture
```
src/table.jsx → src/TableUI.jsx → src/tableLogic.js
src/table.jsx → src/tableActions.js → src/tableLogic.js
```
- **src/table.jsx** orchestrates game state and delegates to TableUI for rendering
- **src/TableUI.jsx** is pure presentation layer, calls event handlers from table.jsx
- **src/tableActions.js** contains complex action logic, imports utilities from tableLogic.js
- **src/tableLogic.js** provides core utilities used by both table.jsx and tableActions.js

### Data Flow Dependencies
```
src/initialDeck.js → src/table.jsx → src/tableActions.js → src/tableLogic.js
```
- **src/initialDeck.js** provides static deck data imported by table.jsx
- **src/table.jsx** passes game state to tableActions.js functions
- **src/tableActions.js** uses tableLogic.js utilities for validation and calculations
- **src/tableLogic.js** operates on data structures defined in table.jsx

### Client-Server Communication
```
src/GameRoom.jsx ↔ server.js ↔ src/table.jsx
```
- **src/GameRoom.jsx** establishes Socket.IO connection with server.js
- **server.js** manages game state synchronization and broadcasts to all clients
- **src/table.jsx** receives real-time updates via Socket.IO from server.js
- All three components coordinate for multiplayer functionality

### Styling Dependencies
```
src/App.css → [ALL React Components]
```
- **src/App.css** contains styles for all components in the application
- Every React component relies on CSS classes defined in App.css
- Components reference specific CSS classes (e.g., `.playTable`, `.handCard`, `.stackCard`)

### Key Interdependency Patterns

**State Management Flow:**
- `table.jsx` maintains master game state
- `TableUI.jsx` receives state as props, sends events back via callbacks
- `tableActions.js` functions modify state and return new state objects
- `tableLogic.js` provides pure utility functions for calculations

**Socket Communication Pattern:**
- `GameRoom.jsx` establishes Socket.IO connection and passes to `table.jsx`
- `table.jsx` emits game actions via `onGameAction` callback to GameRoom
- `GameRoom.jsx` forwards actions to `server.js` via Socket.IO
- `server.js` broadcasts updates to all connected clients

**Import Hierarchy:**
```
tableLogic.js (bottom layer - pure utilities)
    ↑
tableActions.js (business logic layer)
    ↑
table.jsx (state management layer)
    ↑
TableUI.jsx (presentation layer)
```

**Cross-Component Data Sharing:**
- User data flows from App.jsx → Lobby.jsx → GameRoom.jsx → table.jsx
- Game state flows from server.js → GameRoom.jsx → table.jsx → TableUI.jsx
- Player actions flow from TableUI.jsx → table.jsx → GameRoom.jsx → server.js

**Critical Dependencies:**
- `table.jsx` **CANNOT** function without `tableLogic.js` and `tableActions.js`
- `TableUI.jsx` **REQUIRES** event handlers from `table.jsx` to be interactive
- `GameRoom.jsx` **NEEDS** Socket.IO connection to synchronize with other players
- All components **DEPEND** on `App.css` for proper visual rendering