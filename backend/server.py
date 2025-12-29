from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import io
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "team_owner"

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    team_id: Optional[str] = None
    created_at: datetime

class TeamCreate(BaseModel):
    name: str
    short_name: str
    logo_url: Optional[str] = None
    budget: float = 10000000
    owner_email: Optional[str] = None
    tournament_id: Optional[str] = None

class Team(BaseModel):
    team_id: str
    name: str
    short_name: str
    logo_url: Optional[str] = None
    budget: float
    remaining_budget: float
    owner_id: Optional[str] = None
    owner_email: Optional[str] = None
    players: List[str] = []
    tournament_id: Optional[str] = None
    created_at: datetime

class PlayerCreate(BaseModel):
    name: str
    role: str
    base_price: float
    image_url: Optional[str] = None
    age: Optional[int] = None
    batting_style: Optional[str] = None
    bowling_style: Optional[str] = None
    matches: Optional[int] = 0
    runs: Optional[int] = 0
    wickets: Optional[int] = 0
    tournament_id: Optional[str] = None

class Player(BaseModel):
    player_id: str
    name: str
    role: str
    base_price: float
    current_price: float = 0
    image_url: Optional[str] = None
    age: Optional[int] = None
    batting_style: Optional[str] = None
    bowling_style: Optional[str] = None
    matches: Optional[int] = 0
    runs: Optional[int] = 0
    wickets: Optional[int] = 0
    status: str = "unsold"
    sold_to: Optional[str] = None
    sold_price: Optional[float] = None
    tournament_id: Optional[str] = None
    auction_id: Optional[str] = None
    created_at: datetime

# New Models for Tournament and Auction
class BidIncrementRule(BaseModel):
    range_start: float
    increment_by: float

class TournamentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class Tournament(BaseModel):
    tournament_id: str
    name: str
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = "draft"  # draft, active, completed
    created_at: datetime

class AuctionCreate(BaseModel):
    tournament_id: str
    name: str
    date: Optional[str] = None
    players_per_team: int = 15
    bid_increment_rules: List[Dict] = []  # [{range_start: 1000, increment_by: 100}, ...]

class Auction(BaseModel):
    auction_id: str
    tournament_id: str
    name: str
    date: Optional[str] = None
    players_per_team: int = 15
    bid_increment_rules: List[Dict] = []
    status: str = "draft"  # draft, live, paused, completed
    current_player_id: Optional[str] = None
    current_bid: float = 0
    current_bidder_id: Optional[str] = None
    current_bidder_name: Optional[str] = None
    bid_history: List[dict] = []
    created_at: datetime

class AdminBidRequest(BaseModel):
    team_id: str

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token in cookies or Authorization header"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    return user

async def require_auth(request: Request) -> dict:
    """Require authentication, raise 401 if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> dict:
    """Require admin role"""
    user = await require_auth(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    
    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    
    auth_data = auth_response.json()
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    session_token = auth_data.get("session_token")
    
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "team_owner",
            "team_id": None,
            "created_at": datetime.now(timezone.utc)
        })
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return user

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    return {"message": "Logged out"}

# ==================== USER MANAGEMENT ====================

@api_router.get("/users", response_model=List[dict])
async def get_users(request: Request):
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    new_role = body.get("role")
    
    if new_role not in ["admin", "team_owner"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": new_role}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated"}

@api_router.put("/users/{user_id}/team")
async def assign_user_team(user_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    team_id = body.get("team_id")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"team_id": team_id}}
    )
    
    if team_id:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        await db.teams.update_one(
            {"team_id": team_id},
            {"$set": {"owner_id": user_id, "owner_email": user.get("email")}}
        )
    
    return {"message": "Team assigned"}

# ==================== TOURNAMENT ENDPOINTS ====================

@api_router.post("/tournaments")
async def create_tournament(tournament: TournamentCreate, request: Request):
    """Create a new tournament (admin only)"""
    await require_admin(request)
    
    tournament_id = f"tournament_{uuid.uuid4().hex[:8]}"
    tournament_doc = {
        "tournament_id": tournament_id,
        "name": tournament.name,
        "description": tournament.description,
        "start_date": tournament.start_date,
        "end_date": tournament.end_date,
        "status": "draft",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.tournaments.insert_one(tournament_doc)
    return await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})

@api_router.get("/tournaments")
async def get_tournaments():
    """Get all tournaments"""
    tournaments = await db.tournaments.find({}, {"_id": 0}).to_list(100)
    return tournaments

@api_router.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str):
    """Get tournament by ID"""
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament

@api_router.put("/tournaments/{tournament_id}")
async def update_tournament(tournament_id: str, tournament: TournamentCreate, request: Request):
    """Update tournament (admin only)"""
    await require_admin(request)
    
    result = await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$set": {
            "name": tournament.name,
            "description": tournament.description,
            "start_date": tournament.start_date,
            "end_date": tournament.end_date
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    return await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})

@api_router.delete("/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str, request: Request):
    """Delete tournament (admin only)"""
    await require_admin(request)
    
    result = await db.tournaments.delete_one({"tournament_id": tournament_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Also delete related auctions
    await db.auctions.delete_many({"tournament_id": tournament_id})
    
    return {"message": "Tournament deleted"}

# ==================== AUCTION CONFIGURATION ENDPOINTS ====================

@api_router.post("/auctions")
async def create_auction(auction: AuctionCreate, request: Request):
    """Create a new auction for a tournament (admin only)"""
    await require_admin(request)
    
    # Verify tournament exists
    tournament = await db.tournaments.find_one({"tournament_id": auction.tournament_id})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    auction_id = f"auction_{uuid.uuid4().hex[:8]}"
    auction_doc = {
        "auction_id": auction_id,
        "tournament_id": auction.tournament_id,
        "name": auction.name,
        "date": auction.date,
        "players_per_team": auction.players_per_team,
        "bid_increment_rules": auction.bid_increment_rules,
        "status": "draft",
        "current_player_id": None,
        "current_bid": 0,
        "current_bidder_id": None,
        "current_bidder_name": None,
        "bid_history": [],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.auctions.insert_one(auction_doc)
    return await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})

@api_router.get("/auctions")
async def get_auctions(tournament_id: Optional[str] = None):
    """Get all auctions, optionally filtered by tournament"""
    query = {}
    if tournament_id:
        query["tournament_id"] = tournament_id
    
    auctions = await db.auctions.find(query, {"_id": 0}).to_list(100)
    return auctions

@api_router.get("/auctions/{auction_id}")
async def get_auction(auction_id: str):
    """Get auction by ID with full details"""
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Get current player details if in auction
    current_player = None
    if auction.get("current_player_id"):
        current_player = await db.players.find_one(
            {"player_id": auction["current_player_id"]},
            {"_id": 0}
        )
    
    # Get current bidder team details
    current_bidder_team = None
    if auction.get("current_bidder_id"):
        current_bidder_team = await db.teams.find_one(
            {"team_id": auction["current_bidder_id"]},
            {"_id": 0}
        )
    
    # Get teams for this tournament
    teams = await db.teams.find(
        {"tournament_id": auction["tournament_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return {
        **auction,
        "current_player": current_player,
        "current_bidder_team": current_bidder_team,
        "teams": teams
    }

@api_router.put("/auctions/{auction_id}")
async def update_auction(auction_id: str, auction: AuctionCreate, request: Request):
    """Update auction configuration (admin only)"""
    await require_admin(request)
    
    result = await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "name": auction.name,
            "date": auction.date,
            "players_per_team": auction.players_per_team,
            "bid_increment_rules": auction.bid_increment_rules
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    return await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})

@api_router.delete("/auctions/{auction_id}")
async def delete_auction(auction_id: str, request: Request):
    """Delete auction (admin only)"""
    await require_admin(request)
    
    result = await db.auctions.delete_one({"auction_id": auction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    return {"message": "Auction deleted"}

# ==================== AUCTION CONTROL ENDPOINTS ====================

@api_router.post("/auctions/{auction_id}/start")
async def start_auction(auction_id: str, request: Request):
    """Start the auction (admin only)"""
    await require_admin(request)
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"status": "live"}}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/pause")
async def pause_auction(auction_id: str, request: Request):
    """Pause the auction (admin only)"""
    await require_admin(request)
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"status": "paused"}}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/stop")
async def stop_auction(auction_id: str, request: Request):
    """Stop/Complete the auction (admin only)"""
    await require_admin(request)
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"status": "completed"}}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/set-player/{player_id}")
async def set_auction_player(auction_id: str, player_id: str, request: Request):
    """Set current player for auction (admin only)"""
    await require_admin(request)
    
    player = await db.players.find_one({"player_id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if player["status"] == "sold":
        raise HTTPException(status_code=400, detail="Player already sold")
    
    # Update player status
    await db.players.update_one(
        {"player_id": player_id},
        {"$set": {"status": "in_auction", "current_price": player["base_price"], "auction_id": auction_id}}
    )
    
    # Update auction state
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "current_player_id": player_id,
            "current_bid": player["base_price"],
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }}
    )
    
    return await get_auction(auction_id)

def get_bid_increment(current_bid: float, rules: List[Dict]) -> float:
    """Calculate bid increment based on rules"""
    if not rules:
        # Default increments
        if current_bid >= 10000000:
            return 2500000
        if current_bid >= 5000000:
            return 1000000
        if current_bid >= 1000000:
            return 500000
        if current_bid >= 500000:
            return 100000
        return 50000
    
    # Sort rules by range_start descending
    sorted_rules = sorted(rules, key=lambda x: x.get("range_start", 0), reverse=True)
    
    for rule in sorted_rules:
        if current_bid >= rule.get("range_start", 0):
            return rule.get("increment_by", 50000)
    
    return 50000  # Default increment

@api_router.post("/auctions/{auction_id}/admin-bid")
async def admin_place_bid(auction_id: str, bid: AdminBidRequest, request: Request):
    """Admin places bid on behalf of a team (admin only)"""
    await require_admin(request)
    
    # Get auction state
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.get("status") != "live":
        raise HTTPException(status_code=400, detail="Auction is not live")
    
    if not auction.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    # Get team
    team = await db.teams.find_one({"team_id": bid.team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Calculate new bid amount
    current_bid = auction.get("current_bid", 0)
    increment = get_bid_increment(current_bid, auction.get("bid_increment_rules", []))
    new_bid = current_bid + increment
    
    # Check team budget
    if new_bid > team.get("remaining_budget", 0):
        raise HTTPException(status_code=400, detail=f"Insufficient budget. Team has {team.get('remaining_budget', 0)}, bid is {new_bid}")
    
    # Check players per team limit
    players_per_team = auction.get("players_per_team", 15)
    if len(team.get("players", [])) >= players_per_team:
        raise HTTPException(status_code=400, detail=f"Team already has maximum {players_per_team} players")
    
    # Update auction state
    bid_entry = {
        "team_id": bid.team_id,
        "team_name": team["name"],
        "team_short_name": team.get("short_name", ""),
        "amount": new_bid,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {
            "$set": {
                "current_bid": new_bid,
                "current_bidder_id": bid.team_id,
                "current_bidder_name": team["name"]
            },
            "$push": {"bid_history": bid_entry}
        }
    )
    
    # Update player current price
    await db.players.update_one(
        {"player_id": auction["current_player_id"]},
        {"$set": {"current_price": new_bid}}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/decrease-bid")
async def decrease_bid(auction_id: str, request: Request):
    """Decrease bid (undo last bid) - admin only"""
    await require_admin(request)
    
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    bid_history = auction.get("bid_history", [])
    
    if len(bid_history) <= 1:
        # Reset to base price
        player = await db.players.find_one({"player_id": auction["current_player_id"]}, {"_id": 0})
        base_price = player.get("base_price", 0) if player else 0
        
        await db.auctions.update_one(
            {"auction_id": auction_id},
            {"$set": {
                "current_bid": base_price,
                "current_bidder_id": None,
                "current_bidder_name": None,
                "bid_history": []
            }}
        )
        
        await db.players.update_one(
            {"player_id": auction["current_player_id"]},
            {"$set": {"current_price": base_price}}
        )
    else:
        # Remove last bid and restore previous
        bid_history.pop()
        previous_bid = bid_history[-1] if bid_history else None
        
        if previous_bid:
            await db.auctions.update_one(
                {"auction_id": auction_id},
                {"$set": {
                    "current_bid": previous_bid["amount"],
                    "current_bidder_id": previous_bid["team_id"],
                    "current_bidder_name": previous_bid["team_name"],
                    "bid_history": bid_history
                }}
            )
            
            await db.players.update_one(
                {"player_id": auction["current_player_id"]},
                {"$set": {"current_price": previous_bid["amount"]}}
            )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/sell")
async def sell_player(auction_id: str, request: Request):
    """Sell current player to highest bidder (admin only)"""
    await require_admin(request)
    
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction or not auction.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    if not auction.get("current_bidder_id"):
        raise HTTPException(status_code=400, detail="No bids placed")
    
    player_id = auction["current_player_id"]
    team_id = auction["current_bidder_id"]
    sold_price = auction["current_bid"]
    
    # Update player
    await db.players.update_one(
        {"player_id": player_id},
        {"$set": {
            "status": "sold",
            "sold_to": team_id,
            "sold_price": sold_price,
            "current_price": sold_price,
            "auction_id": auction_id
        }}
    )
    
    # Update team
    await db.teams.update_one(
        {"team_id": team_id},
        {
            "$inc": {"remaining_budget": -sold_price},
            "$push": {"players": player_id}
        }
    )
    
    # Clear auction state
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/unsold")
async def mark_unsold(auction_id: str, request: Request):
    """Mark current player as unsold (admin only)"""
    await require_admin(request)
    
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction or not auction.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    # Update player
    await db.players.update_one(
        {"player_id": auction["current_player_id"]},
        {"$set": {"status": "unsold", "current_price": 0, "auction_id": None}}
    )
    
    # Clear auction state
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/reset")
async def reset_auction(auction_id: str, request: Request):
    """Reset entire auction (admin only)"""
    await require_admin(request)
    
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    tournament_id = auction["tournament_id"]
    
    # Reset all players for this tournament
    await db.players.update_many(
        {"tournament_id": tournament_id},
        {"$set": {
            "status": "unsold",
            "sold_to": None,
            "sold_price": None,
            "current_price": 0,
            "auction_id": None
        }}
    )
    
    # Reset all team budgets and players for this tournament
    teams = await db.teams.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    for team in teams:
        await db.teams.update_one(
            {"team_id": team["team_id"]},
            {"$set": {
                "remaining_budget": team.get("budget", 10000000),
                "players": []
            }}
        )
    
    # Reset auction state
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "status": "draft",
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }}
    )
    
    return await get_auction(auction_id)

# ==================== TEAM ENDPOINTS ====================

@api_router.post("/teams")
async def create_team(team: TeamCreate, request: Request):
    """Create a new team (admin only)"""
    await require_admin(request)
    
    team_id = f"team_{uuid.uuid4().hex[:8]}"
    team_doc = {
        "team_id": team_id,
        "name": team.name,
        "short_name": team.short_name,
        "logo_url": team.logo_url,
        "budget": team.budget,
        "remaining_budget": team.budget,
        "owner_id": None,
        "owner_email": team.owner_email,
        "players": [],
        "tournament_id": team.tournament_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.teams.insert_one(team_doc)
    
    return await db.teams.find_one({"team_id": team_id}, {"_id": 0})

@api_router.get("/teams")
async def get_teams(tournament_id: Optional[str] = None):
    """Get all teams, optionally filtered by tournament"""
    query = {}
    if tournament_id:
        query["tournament_id"] = tournament_id
    
    teams = await db.teams.find(query, {"_id": 0}).to_list(100)
    return teams

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str):
    """Get team by ID"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team

@api_router.put("/teams/{team_id}")
async def update_team(team_id: str, team: TeamCreate, request: Request):
    """Update team (admin only)"""
    await require_admin(request)
    
    result = await db.teams.update_one(
        {"team_id": team_id},
        {"$set": {
            "name": team.name,
            "short_name": team.short_name,
            "logo_url": team.logo_url,
            "budget": team.budget,
            "owner_email": team.owner_email,
            "tournament_id": team.tournament_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return await db.teams.find_one({"team_id": team_id}, {"_id": 0})

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, request: Request):
    """Delete team (admin only)"""
    await require_admin(request)
    
    result = await db.teams.delete_one({"team_id": team_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"message": "Team deleted"}

@api_router.get("/teams/{team_id}/squad")
async def get_team_squad(team_id: str):
    """Get team's players"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    players = await db.players.find(
        {"sold_to": team_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"team": team, "players": players}

# ==================== PLAYER ENDPOINTS ====================

@api_router.post("/players")
async def create_player(player: PlayerCreate, request: Request):
    """Create a new player (admin only)"""
    await require_admin(request)
    
    player_id = f"player_{uuid.uuid4().hex[:8]}"
    player_doc = {
        "player_id": player_id,
        "name": player.name,
        "role": player.role,
        "base_price": player.base_price,
        "current_price": 0,
        "image_url": player.image_url,
        "age": player.age,
        "batting_style": player.batting_style,
        "bowling_style": player.bowling_style,
        "matches": player.matches,
        "runs": player.runs,
        "wickets": player.wickets,
        "status": "unsold",
        "sold_to": None,
        "sold_price": None,
        "tournament_id": player.tournament_id,
        "auction_id": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.players.insert_one(player_doc)
    
    return await db.players.find_one({"player_id": player_id}, {"_id": 0})

@api_router.get("/players")
async def get_players(status: Optional[str] = None, tournament_id: Optional[str] = None):
    """Get all players, optionally filtered by status and tournament"""
    query = {}
    if status:
        query["status"] = status
    if tournament_id:
        query["tournament_id"] = tournament_id
    
    players = await db.players.find(query, {"_id": 0}).to_list(1000)
    return players

@api_router.get("/players/{player_id}")
async def get_player(player_id: str):
    """Get player by ID"""
    player = await db.players.find_one({"player_id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player

@api_router.put("/players/{player_id}")
async def update_player(player_id: str, player: PlayerCreate, request: Request):
    """Update player (admin only)"""
    await require_admin(request)
    
    result = await db.players.update_one(
        {"player_id": player_id},
        {"$set": {
            "name": player.name,
            "role": player.role,
            "base_price": player.base_price,
            "image_url": player.image_url,
            "age": player.age,
            "batting_style": player.batting_style,
            "bowling_style": player.bowling_style,
            "matches": player.matches,
            "runs": player.runs,
            "wickets": player.wickets,
            "tournament_id": player.tournament_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return await db.players.find_one({"player_id": player_id}, {"_id": 0})

@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str, request: Request):
    """Delete player (admin only)"""
    await require_admin(request)
    
    result = await db.players.delete_one({"player_id": player_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return {"message": "Player deleted"}

@api_router.post("/players/{player_id}/reset")
async def reset_player(player_id: str, request: Request):
    """Reset player to unsold status (admin only)"""
    await require_admin(request)
    
    player = await db.players.find_one({"player_id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if player.get("sold_to") and player.get("sold_price"):
        await db.teams.update_one(
            {"team_id": player["sold_to"]},
            {
                "$inc": {"remaining_budget": player["sold_price"]},
                "$pull": {"players": player_id}
            }
        )
    
    await db.players.update_one(
        {"player_id": player_id},
        {"$set": {
            "status": "unsold",
            "sold_to": None,
            "sold_price": None,
            "current_price": 0,
            "auction_id": None
        }}
    )
    
    return await db.players.find_one({"player_id": player_id}, {"_id": 0})

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(tournament_id: Optional[str] = None):
    """Get dashboard statistics"""
    query = {}
    if tournament_id:
        query["tournament_id"] = tournament_id
    
    total_players = await db.players.count_documents(query)
    sold_players = await db.players.count_documents({**query, "status": "sold"})
    unsold_players = await db.players.count_documents({**query, "status": "unsold"})
    total_teams = await db.teams.count_documents(query if tournament_id else {})
    total_tournaments = await db.tournaments.count_documents({})
    total_auctions = await db.auctions.count_documents(query if tournament_id else {})
    
    sold = await db.players.find({**query, "status": "sold"}, {"_id": 0, "sold_price": 1}).to_list(1000)
    total_spent = sum(p.get("sold_price", 0) or 0 for p in sold)
    
    return {
        "total_players": total_players,
        "sold_players": sold_players,
        "unsold_players": unsold_players,
        "in_auction": await db.players.count_documents({**query, "status": "in_auction"}),
        "total_teams": total_teams,
        "total_tournaments": total_tournaments,
        "total_auctions": total_auctions,
        "total_spent": total_spent
    }

# ==================== LEGACY AUCTION STATE (for backward compatibility) ====================

@api_router.get("/auction/state")
async def get_auction_state():
    """Get current auction state (legacy endpoint)"""
    # Find the first live auction
    auction = await db.auctions.find_one({"status": "live"}, {"_id": 0})
    
    if not auction:
        # Return empty state
        return {
            "auction_id": None,
            "is_active": False,
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": [],
            "current_player": None,
            "current_bidder_team": None
        }
    
    return await get_auction(auction["auction_id"])

@api_router.post("/auction/start")
async def legacy_start_auction(request: Request):
    """Legacy start auction endpoint"""
    await require_admin(request)
    auction = await db.auctions.find_one({"status": {"$in": ["draft", "paused"]}}, {"_id": 0})
    if auction:
        return await start_auction(auction["auction_id"], request)
    raise HTTPException(status_code=404, detail="No auction to start")

@api_router.post("/auction/stop")
async def legacy_stop_auction(request: Request):
    """Legacy stop auction endpoint"""
    await require_admin(request)
    auction = await db.auctions.find_one({"status": "live"}, {"_id": 0})
    if auction:
        return await pause_auction(auction["auction_id"], request)
    raise HTTPException(status_code=404, detail="No active auction")

# ==================== BASIC ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "Cricket Auction API v2"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
