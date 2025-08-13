# Database Setup Reference

## PostgreSQL Installation & Configuration

### Local Development Setup
- **Database Name:** `seep_game`
- **User:** `seep_user`
- **Password:** `seep_password`
- **Host:** `localhost`
- **Port:** `5432`

### Installation Commands (macOS)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Database Creation Commands
```sql
-- Connect as superuser
psql postgres

-- Create database and user
CREATE DATABASE seep_game;
CREATE USER seep_user WITH PASSWORD 'seep_password';
GRANT ALL PRIVILEGES ON DATABASE seep_game TO seep_user;
ALTER DATABASE seep_game OWNER TO seep_user;
GRANT ALL ON SCHEMA public TO seep_user;
GRANT CREATE ON SCHEMA public TO seep_user;
\q
```

### Database Schema

**Users Table:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Games Table:**
```sql
CREATE TABLE games (
    id VARCHAR(50) PRIMARY KEY,
    creator_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'waiting',
    players JSONB,
    player_names JSONB,
    game_state JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### NPM Dependencies
```bash
npm install pg bcryptjs jsonwebtoken
```

### Connection Files
- **Database connection:** `src/db.js`
- **Auth utilities:** `src/auth.js`

### Test Connection
```bash
psql -h localhost -U seep_user -d seep_game
```

### Verify Tables
```sql
\dt  -- Shows both users and games tables
```