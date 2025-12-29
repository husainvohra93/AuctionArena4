# Cricket Auction Portal (CRICKETMART) - PRD

## Original Problem Statement
Create a Web portal for auction of a local cricket tournament with Admin Panel and Auction Panel.

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
- [x] Teams CRUD with budget management
- [x] Players CRUD with stats (matches, runs, wickets)
- [x] Auction state management
- [x] Live bidding system
- [x] Sell/Unsold/Reset player functionality
- [x] Dashboard statistics

### Frontend (React)
- [x] Login page with Google Auth
- [x] Admin Dashboard with stats overview
- [x] Player Management (CRUD, filters)
- [x] Team Management (CRUD, user assignment)
- [x] Auction Control panel
- [x] Live Auction room with real-time updates
- [x] Team Owner Dashboard
- [x] Stadium Night dark theme design

### API Endpoints
- `POST /api/auth/session` - Exchange session ID for token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET/POST /api/teams` - Teams CRUD
- `GET/POST /api/players` - Players CRUD
- `GET /api/auction/state` - Get auction state
- `POST /api/auction/start|stop` - Control auction
- `POST /api/auction/set-player/{id}` - Set player for auction
- `POST /api/auction/bid` - Place bid
- `POST /api/auction/sell|unsold` - Mark player sold/unsold
- `POST /api/auction/reset` - Reset entire auction
- `GET /api/stats/dashboard` - Dashboard stats

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
