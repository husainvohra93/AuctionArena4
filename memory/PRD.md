# Cricket Auction Portal (CRICKETMART) - PRD

## Original Problem Statement
Create a Web portal for auction of a local cricket tournament with Admin Panel and Auction Panel.

## Update (Dec 29, 2025) - Multi-Tournament & Advanced Auction Features
Added support for multiple tournaments, configurable auctions with dynamic bid increments, admin auction control with team bid buttons, and public view screen for audience.

## User Choices
- Player Management: Yes with name, role, base price, images
- Teams: Dynamic up to 20 teams with fixed budget/purse
- Live Bidding: Real-time updates
- Player Status: Sold/Unsold
- Timer: No
- Authentication: Separate login for Admin vs Team owners using Google Auth
- Theme: Dark (Stadium Night)

## User Personas
1. **Admin**: Tournament organizer who manages players, teams, and controls the auction
2. **Team Owner**: Registered team owner who participates in bidding for players

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Authentication**: Emergent Google OAuth with role-based access
- **Real-time**: Polling-based live updates (1.5s interval)

## What's Been Implemented (Dec 29, 2025)

### Backend (FastAPI)
- [x] Emergent Google OAuth authentication
- [x] Role-based access control (Admin/Team Owner)
- [x] **Tournament Management** - Create/manage multiple tournaments
- [x] **Auction Configuration** - Name, date, players per team limit, dynamic bid increment rules
- [x] Teams CRUD with budget management (per tournament)
- [x] Players CRUD with stats (per tournament)
- [x] **Admin Bid Control** - Bid on behalf of teams via button clicks
- [x] **Decrease Bid** - Undo last bid for manual corrections
- [x] Live bidding with dynamic increments (e.g., +100 until 1000, then +200)
- [x] Sell/Unsold/Reset player functionality
- [x] Dashboard statistics

### Frontend (React)
- [x] Login page with Google Auth
- [x] Admin Dashboard with stats overview
- [x] **Tournament Management** - Create/edit tournaments
- [x] **Auction Management** - Configure auctions with bid increment rules
- [x] **Admin Auction Control** - Team bid buttons, decrease bid, sold/unsold
- [x] **Public View Screen** - No-auth display for audience (real-time player, bids, teams)
- [x] Player Management (CRUD, filters, per tournament)
- [x] Team Management (CRUD, user assignment, per tournament)
- [x] Live Auction room with real-time updates
- [x] Team Owner Dashboard
- [x] Stadium Night dark theme design

### API Endpoints
- `POST /api/auth/session` - Exchange session ID for token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- **Tournament APIs**:
  - `GET/POST /api/tournaments` - Tournament CRUD
  - `GET/PUT/DELETE /api/tournaments/{id}` - Single tournament operations
- **Auction APIs**:
  - `GET/POST /api/auctions` - Auction CRUD with bid increment rules
  - `POST /api/auctions/{id}/start|pause|stop` - Auction state control
  - `POST /api/auctions/{id}/set-player/{playerId}` - Set player for bidding
  - `POST /api/auctions/{id}/admin-bid` - Admin bids on behalf of team
  - `POST /api/auctions/{id}/decrease-bid` - Undo last bid
  - `POST /api/auctions/{id}/sell|unsold` - Mark player sold/unsold
  - `POST /api/auctions/{id}/reset` - Reset entire auction
- `GET/POST /api/teams` - Teams CRUD (with tournament_id filter)
- `GET/POST /api/players` - Players CRUD (with tournament_id filter)
- `GET /api/stats/dashboard` - Dashboard stats

### Frontend Routes
- `/admin/tournaments` - Tournament management
- `/admin/tournaments/{id}/auctions` - Auction management for tournament
- `/admin/auction/{auctionId}/control` - Admin auction control panel
- `/auction/{auctionId}/view` - Public view screen (no auth)

## Prioritized Backlog

### P0 (Critical) - Done
- [x] Authentication & Authorization
- [x] Team/Player Management
- [x] Auction Control
- [x] Live Bidding

### P1 (High) - Future
- [ ] WebSocket for true real-time updates (currently polling)
- [ ] Image upload for player photos
- [ ] Bulk player import (CSV)
- [ ] Export auction results

### P2 (Medium) - Future
- [ ] Auction history/logs
- [ ] Team owner notifications
- [ ] Player categories/tiers
- [ ] Budget alerts

### P3 (Low) - Future
- [ ] Dark/Light theme toggle
- [ ] Mobile responsive optimizations
- [ ] Admin analytics dashboard
- [ ] Multi-language support

## Next Action Items
1. Add more sample players and teams for demo
2. Consider WebSocket integration for instant updates
3. Add bulk player import feature
4. Implement image upload for players
