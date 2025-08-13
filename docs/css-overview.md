## CSS Organization & Structure

### Current Structure
```
src/App.css - Complete application stylesheet (1,200+ lines)
```
Single file containing all styles: global, page-specific, and component styles with responsive design.

### Recommended Modular Structure
```
src/
├── App.css (main import file)
└── styles/
    ├── base.css      (global styles, header, buttons, responsive)
    ├── login.css     (login page specific styles)
    ├── lobby.css     (lobby and game room styles)
    └── table.css     (game table, cards, players, animations)
```

**Implementation:**
```css
/* src/App.css */
@import './styles/base.css';
@import './styles/login.css';
@import './styles/lobby.css';
@import './styles/table.css';
```

### File Breakdown

**base.css** - Global styles (`main`, `.header`, buttons, responsive breakpoints)
**login.css** - Login form (`.login-container`, `.form-group`)
**lobby.css** - Lobby & waiting room (`.lobby-container`, `.game-room`, `.player-positions`)
**table.css** - Game table (`.playTable`, `.playerArea`, `.handCard`, `.stackCard`, animations)

### Key CSS Classes Reference

*Layout:* `.playTable`, `.playerArea`, `.pointsSection`, `.controls`
*Cards:* `.handCard`, `.cardImage`, `.stackCard`, `.collectedCard`, `.tableCard`
*States:* `.selected`, `.selected-for-add`, `.can-add`, `.active`
*Pages:* `.login-container`, `.lobby-container`, `.game-room`, `.header`