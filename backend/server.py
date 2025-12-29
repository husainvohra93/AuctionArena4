from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
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
    pick_mode: str = "manual"  # manual or random
    random_pick_delay: int = 5  # seconds delay for random pick

class Auction(BaseModel):
    auction_id: str
    tournament_id: str
    name: str
    date: Optional[str] = None
    players_per_team: int = 15
    bid_increment_rules: List[Dict] = []
    pick_mode: str = "manual"
    random_pick_delay: int = 5
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
        "pick_mode": auction.pick_mode,
        "random_pick_delay": auction.random_pick_delay,
        "status": "draft",
        "current_player_id": None,
        "current_bid": 0,
        "current_bidder_id": None,
        "current_bidder_name": None,
        "bid_history": [],
        "last_sold_player_id": None,
        "last_sold_time": None,
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
    
    # Get unsold players (first auction) and previously unsold players (re-auction pool)
    unsold_players = await db.players.find(
        {"tournament_id": auction["tournament_id"], "status": "unsold", "was_unsold": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    # Re-auction pool (players marked unsold in previous rounds)
    reauction_pool = await db.players.find(
        {"tournament_id": auction["tournament_id"], "status": "unsold", "was_unsold": True},
        {"_id": 0}
    ).to_list(1000)
    
    # Check if there was a recent sale for confetti trigger
    last_sold = auction.get("last_sold_player_id")
    last_sold_time = auction.get("last_sold_time")
    last_sold_team_id = auction.get("last_sold_team_id")
    last_sold_price = auction.get("last_sold_price")
    show_confetti = False
    last_sold_player = None
    last_sold_team = None
    
    if last_sold_time:
        if isinstance(last_sold_time, str):
            last_sold_time = datetime.fromisoformat(last_sold_time.replace('Z', '+00:00'))
        elif last_sold_time.tzinfo is None:
            last_sold_time = last_sold_time.replace(tzinfo=timezone.utc)
        time_diff = (datetime.now(timezone.utc) - last_sold_time).total_seconds()
        show_confetti = time_diff < 4  # Show confetti for 4 seconds after sale
        
        # Get last sold player details
        if last_sold and show_confetti:
            last_sold_player = await db.players.find_one({"player_id": last_sold}, {"_id": 0})
            if last_sold_team_id:
                last_sold_team = await db.teams.find_one({"team_id": last_sold_team_id}, {"_id": 0})
    
    return {
        **auction,
        "current_player": current_player,
        "current_bidder_team": current_bidder_team,
        "teams": teams,
        "unsold_players": unsold_players,
        "reauction_pool": reauction_pool,
        "show_confetti": show_confetti,
        "last_sold_player_id": last_sold,
        "last_sold_player": last_sold_player,
        "last_sold_team": last_sold_team,
        "last_sold_price": last_sold_price
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
            "bid_increment_rules": auction.bid_increment_rules,
            "pick_mode": auction.pick_mode,
            "random_pick_delay": auction.random_pick_delay
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
    
    # Clear auction state and set confetti trigger with sold info
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": [],
            "last_sold_player_id": player_id,
            "last_sold_team_id": team_id,
            "last_sold_price": sold_price,
            "last_sold_time": datetime.now(timezone.utc)
        }}
    )
    
    return await get_auction(auction_id)

@api_router.post("/auctions/{auction_id}/unsold")
async def mark_unsold(auction_id: str, request: Request):
    """Mark current player as unsold and add to re-auction pool (admin only)"""
    await require_admin(request)
    
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction or not auction.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    # Update player - mark as unsold and flag for re-auction pool
    await db.players.update_one(
        {"player_id": auction["current_player_id"]},
        {"$set": {"status": "unsold", "current_price": 0, "auction_id": None, "was_unsold": True}}
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

@api_router.post("/auctions/{auction_id}/random-pick")
async def random_pick_player(auction_id: str, request: Request, from_reauction: bool = False):
    """Randomly pick a player for auction (admin only)"""
    await require_admin(request)
    
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.get("current_player_id"):
        raise HTTPException(status_code=400, detail="Current player must be sold/unsold first")
    
    # Get available players
    if from_reauction:
        # Pick from re-auction pool
        players = await db.players.find(
            {"tournament_id": auction["tournament_id"], "status": "unsold", "was_unsold": True},
            {"_id": 0}
        ).to_list(1000)
    else:
        # Pick from main pool (not yet auctioned)
        players = await db.players.find(
            {"tournament_id": auction["tournament_id"], "status": "unsold", "was_unsold": {"$ne": True}},
            {"_id": 0}
        ).to_list(1000)
    
    if not players:
        raise HTTPException(status_code=400, detail="No players available in pool")
    
    # Random pick
    import random
    player = random.choice(players)
    
    # Set player for auction
    await db.players.update_one(
        {"player_id": player["player_id"]},
        {"$set": {"status": "in_auction", "current_price": player["base_price"], "auction_id": auction_id}}
    )
    
    # Update auction state
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "current_player_id": player["player_id"],
            "current_bid": player["base_price"],
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
    
    # Reset all players for this tournament (including was_unsold flag)
    await db.players.update_many(
        {"tournament_id": tournament_id},
        {"$set": {
            "status": "unsold",
            "sold_to": None,
            "sold_price": None,
            "current_price": 0,
            "auction_id": None,
            "was_unsold": False
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

# ==================== EXCEL EXPORT/IMPORT ====================

@api_router.get("/export/teams-template")
async def export_teams_template():
    """Download sample Excel template for teams upload"""
    df = pd.DataFrame({
        'name': ['Mumbai Warriors', 'Delhi Kings'],
        'short_name': ['MW', 'DK'],
        'budget': [10000000, 10000000],
        'owner_email': ['owner1@example.com', 'owner2@example.com'],
        'logo_url': ['https://example.com/logo1.png', '']
    })
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Teams')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=teams_template.xlsx'}
    )

@api_router.get("/export/players-template")
async def export_players_template():
    """Download sample Excel template for players upload"""
    df = pd.DataFrame({
        'name': ['Virat Sharma', 'Rohit Singh', 'MS Dhoni'],
        'role': ['batsman', 'batsman', 'wicket-keeper'],
        'base_price': [500000, 600000, 700000],
        'age': [28, 30, 35],
        'batting_style': ['right-handed', 'right-handed', 'right-handed'],
        'bowling_style': ['', 'right-arm-spin', ''],
        'matches': [50, 60, 100],
        'runs': [2000, 2500, 3000],
        'wickets': [0, 10, 0],
        'image_url': ['https://drive.google.com/uc?export=view&id=YOUR_FILE_ID', '', '']
    })
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Players')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=players_template.xlsx'}
    )

@api_router.post("/import/teams/{tournament_id}")
async def import_teams(tournament_id: str, file: UploadFile = File(...), request: Request = None):
    """Import teams from Excel file"""
    if request:
        await require_admin(request)
    
    # Verify tournament exists
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        teams_created = 0
        for _, row in df.iterrows():
            team_id = f"team_{uuid.uuid4().hex[:8]}"
            budget = float(row.get('budget', 10000000))
            team_doc = {
                "team_id": team_id,
                "name": str(row['name']),
                "short_name": str(row.get('short_name', row['name'][:3].upper())),
                "logo_url": str(row.get('logo_url', '')) if pd.notna(row.get('logo_url')) else None,
                "budget": budget,
                "remaining_budget": budget,
                "owner_id": None,
                "owner_email": str(row.get('owner_email', '')) if pd.notna(row.get('owner_email')) else None,
                "players": [],
                "tournament_id": tournament_id,
                "created_at": datetime.now(timezone.utc)
            }
            await db.teams.insert_one(team_doc)
            teams_created += 1
        
        return {"message": f"Successfully imported {teams_created} teams"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

@api_router.post("/import/players/{tournament_id}")
async def import_players(tournament_id: str, file: UploadFile = File(...), request: Request = None):
    """Import players from Excel file"""
    if request:
        await require_admin(request)
    
    # Verify tournament exists
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        players_created = 0
        for _, row in df.iterrows():
            player_id = f"player_{uuid.uuid4().hex[:8]}"
            player_doc = {
                "player_id": player_id,
                "name": str(row['name']),
                "role": str(row.get('role', 'batsman')).lower(),
                "base_price": float(row.get('base_price', 100000)),
                "current_price": 0,
                "image_url": str(row.get('image_url', '')) if pd.notna(row.get('image_url')) else None,
                "age": int(row['age']) if pd.notna(row.get('age')) else None,
                "batting_style": str(row.get('batting_style', '')) if pd.notna(row.get('batting_style')) else None,
                "bowling_style": str(row.get('bowling_style', '')) if pd.notna(row.get('bowling_style')) else None,
                "matches": int(row.get('matches', 0)) if pd.notna(row.get('matches')) else 0,
                "runs": int(row.get('runs', 0)) if pd.notna(row.get('runs')) else 0,
                "wickets": int(row.get('wickets', 0)) if pd.notna(row.get('wickets')) else 0,
                "status": "unsold",
                "sold_to": None,
                "sold_price": None,
                "tournament_id": tournament_id,
                "auction_id": None,
                "created_at": datetime.now(timezone.utc)
            }
            await db.players.insert_one(player_doc)
            players_created += 1
        
        return {"message": f"Successfully imported {players_created} players"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

@api_router.get("/export/teams/{tournament_id}")
async def export_teams(tournament_id: str):
    """Export all teams with wallet balance for a tournament"""
    teams = await db.teams.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    
    if not teams:
        raise HTTPException(status_code=404, detail="No teams found")
    
    data = []
    for team in teams:
        data.append({
            'Team Name': team.get('name'),
            'Short Name': team.get('short_name'),
            'Total Budget': team.get('budget'),
            'Remaining Budget': team.get('remaining_budget'),
            'Spent': team.get('budget', 0) - team.get('remaining_budget', 0),
            'Players Count': len(team.get('players', [])),
            'Owner Email': team.get('owner_email', '')
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Teams')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=teams_{tournament_id}.xlsx'}
    )

@api_router.get("/export/players/{tournament_id}")
async def export_players(tournament_id: str):
    """Export all auctioned players per team"""
    players = await db.players.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)
    teams = await db.teams.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    
    team_map = {t['team_id']: t['name'] for t in teams}
    
    data = []
    for player in players:
        data.append({
            'Player Name': player.get('name'),
            'Role': player.get('role'),
            'Base Price': player.get('base_price'),
            'Sold Price': player.get('sold_price') or 'Unsold',
            'Status': player.get('status'),
            'Sold To': team_map.get(player.get('sold_to'), 'Unsold'),
            'Age': player.get('age'),
            'Matches': player.get('matches'),
            'Runs': player.get('runs'),
            'Wickets': player.get('wickets')
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Players')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=players_{tournament_id}.xlsx'}
    )

@api_router.get("/export/auction-results/{tournament_id}")
async def export_auction_results(tournament_id: str):
    """Export detailed auction results with players grouped by team"""
    teams = await db.teams.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    players = await db.players.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Summary sheet
        summary_data = []
        for team in teams:
            team_players = [p for p in players if p.get('sold_to') == team['team_id']]
            total_spent = sum(p.get('sold_price', 0) or 0 for p in team_players)
            summary_data.append({
                'Team': team.get('name'),
                'Short Name': team.get('short_name'),
                'Total Budget': team.get('budget'),
                'Spent': total_spent,
                'Remaining': team.get('remaining_budget'),
                'Players Bought': len(team_players)
            })
        
        pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name='Summary')
        
        # Per-team sheets
        for team in teams:
            team_players = [p for p in players if p.get('sold_to') == team['team_id']]
            if team_players:
                team_data = [{
                    'Player': p.get('name'),
                    'Role': p.get('role'),
                    'Price': p.get('sold_price'),
                    'Base Price': p.get('base_price')
                } for p in team_players]
                sheet_name = team.get('short_name', team.get('name'))[:31]  # Excel sheet name limit
                pd.DataFrame(team_data).to_excel(writer, index=False, sheet_name=sheet_name)
        
        # Unsold players
        unsold = [p for p in players if p.get('status') == 'unsold']
        if unsold:
            unsold_data = [{
                'Player': p.get('name'),
                'Role': p.get('role'),
                'Base Price': p.get('base_price')
            } for p in unsold]
            pd.DataFrame(unsold_data).to_excel(writer, index=False, sheet_name='Unsold')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=auction_results_{tournament_id}.xlsx'}
    )

# ==================== IMAGE UPLOAD ====================

import os
import shutil
from pathlib import Path

UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), request: Request = None):
    """Upload an image file and return the URL"""
    if request:
        await require_auth(request)
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: jpg, png, gif, webp")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4().hex}.{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Return the URL
    return {"url": f"/api/uploads/{filename}", "filename": filename}

@api_router.get("/uploads/{filename}")
async def get_uploaded_image(filename: str):
    """Serve uploaded images"""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    content_type = content_types.get(ext, 'application/octet-stream')
    
    from fastapi.responses import FileResponse
    return FileResponse(file_path, media_type=content_type)

# ==================== USER MANAGEMENT (Admin) ====================

class UserCreateAdmin(BaseModel):
    email: str
    name: str
    role: str = "team_owner"
    team_id: Optional[str] = None

class UserUpdateAdmin(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    team_id: Optional[str] = None

@api_router.post("/admin/users")
async def admin_create_user(user_data: UserCreateAdmin, request: Request):
    """Admin creates a new user"""
    await require_admin(request)
    
    # Check if user already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Validate role
    if user_data.role not in ["admin", "team_owner"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'team_owner'")
    
    # Validate team if provided
    if user_data.team_id:
        team = await db.teams.find_one({"team_id": user_data.team_id})
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "picture": None,
        "role": user_data.role,
        "team_id": user_data.team_id,
        "created_at": datetime.now(timezone.utc),
        "created_by_admin": True
    }
    
    await db.users.insert_one(user_doc)
    
    # Update team owner if team assigned
    if user_data.team_id:
        await db.teams.update_one(
            {"team_id": user_data.team_id},
            {"$set": {"owner_id": user_id, "owner_email": user_data.email}}
        )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, user_data: UserUpdateAdmin, request: Request):
    """Admin updates a user"""
    await require_admin(request)
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    
    if user_data.name is not None:
        update_fields["name"] = user_data.name
    
    if user_data.role is not None:
        if user_data.role not in ["admin", "team_owner"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        update_fields["role"] = user_data.role
    
    if user_data.team_id is not None:
        # Handle team assignment/deassignment
        old_team_id = user.get("team_id")
        
        if user_data.team_id == "":
            # Deassign team
            update_fields["team_id"] = None
            if old_team_id:
                await db.teams.update_one(
                    {"team_id": old_team_id},
                    {"$set": {"owner_id": None, "owner_email": None}}
                )
        else:
            # Assign new team
            team = await db.teams.find_one({"team_id": user_data.team_id})
            if not team:
                raise HTTPException(status_code=404, detail="Team not found")
            
            update_fields["team_id"] = user_data.team_id
            
            # Remove old team assignment
            if old_team_id and old_team_id != user_data.team_id:
                await db.teams.update_one(
                    {"team_id": old_team_id},
                    {"$set": {"owner_id": None, "owner_email": None}}
                )
            
            # Set new team owner
            await db.teams.update_one(
                {"team_id": user_data.team_id},
                {"$set": {"owner_id": user_id, "owner_email": user.get("email")}}
            )
    
    if update_fields:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_fields}
        )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, request: Request):
    """Admin deletes a user"""
    current_user = await require_admin(request)
    
    # Prevent self-deletion
    if current_user.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove team assignment if any
    if user.get("team_id"):
        await db.teams.update_one(
            {"team_id": user["team_id"]},
            {"$set": {"owner_id": None, "owner_email": None}}
        )
    
    # Delete user sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    # Delete user
    await db.users.delete_one({"user_id": user_id})
    
    return {"message": "User deleted successfully"}

@api_router.get("/admin/users")
async def admin_get_all_users(request: Request):
    """Admin gets all users with team info"""
    await require_admin(request)
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
    team_map = {t["team_id"]: t for t in teams}
    
    # Enrich users with team details
    for user in users:
        if user.get("team_id") and user["team_id"] in team_map:
            user["team_name"] = team_map[user["team_id"]].get("name")
            user["team_short_name"] = team_map[user["team_id"]].get("short_name")
        else:
            user["team_name"] = None
            user["team_short_name"] = None
    
    return users

# ==================== TEAM OWNER EXPORTS ====================

@api_router.get("/team-owner/export/excel")
async def team_owner_export_excel(request: Request):
    """Team owner exports their team data as Excel"""
    user = await require_auth(request)
    
    if not user.get("team_id"):
        raise HTTPException(status_code=400, detail="No team assigned to your account")
    
    team_id = user["team_id"]
    
    # Get team data
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get tournament data
    tournament = None
    if team.get("tournament_id"):
        tournament = await db.tournaments.find_one({"tournament_id": team["tournament_id"]}, {"_id": 0})
    
    # Get players
    players = await db.players.find({"sold_to": team_id}, {"_id": 0}).to_list(100)
    
    # Get auction data
    auctions = []
    if team.get("tournament_id"):
        auctions = await db.auctions.find({"tournament_id": team["tournament_id"]}, {"_id": 0}).to_list(10)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Team Summary Sheet
        team_data = pd.DataFrame([{
            'Team Name': team.get('name'),
            'Short Name': team.get('short_name'),
            'Tournament': tournament.get('name') if tournament else 'N/A',
            'Total Budget': team.get('budget'),
            'Remaining Budget': team.get('remaining_budget'),
            'Amount Spent': team.get('budget', 0) - team.get('remaining_budget', 0),
            'Players Acquired': len(players),
            'Owner Email': team.get('owner_email', ''),
            'Export Date': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
        }])
        team_data.to_excel(writer, index=False, sheet_name='Team Summary')
        
        # Players Sheet
        if players:
            players_data = pd.DataFrame([{
                'Player Name': p.get('name'),
                'Role': p.get('role'),
                'Base Price': p.get('base_price'),
                'Purchased Price': p.get('sold_price'),
                'Age': p.get('age'),
                'Batting Style': p.get('batting_style'),
                'Bowling Style': p.get('bowling_style'),
                'Matches': p.get('matches'),
                'Runs': p.get('runs'),
                'Wickets': p.get('wickets')
            } for p in players])
            players_data.to_excel(writer, index=False, sheet_name='Squad')
        
        # Auction Info Sheet
        if auctions:
            auction_data = pd.DataFrame([{
                'Auction Name': a.get('name'),
                'Date': a.get('date', 'N/A'),
                'Status': a.get('status'),
                'Players Per Team Limit': a.get('players_per_team')
            } for a in auctions])
            auction_data.to_excel(writer, index=False, sheet_name='Auctions')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename={team.get("short_name", "team")}_data.xlsx'}
    )

@api_router.get("/team-owner/export/pdf")
async def team_owner_export_pdf(request: Request):
    """Team owner exports their team data as PDF"""
    user = await require_auth(request)
    
    if not user.get("team_id"):
        raise HTTPException(status_code=400, detail="No team assigned to your account")
    
    team_id = user["team_id"]
    
    # Get team data
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get tournament data
    tournament = None
    if team.get("tournament_id"):
        tournament = await db.tournaments.find_one({"tournament_id": team["tournament_id"]}, {"_id": 0})
    
    # Get players
    players = await db.players.find({"sold_to": team_id}, {"_id": 0}).to_list(100)
    
    # Generate HTML for PDF
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; }}
            h1 {{ color: #1e3a5f; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }}
            h2 {{ color: #374151; margin-top: 30px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
            th, td {{ border: 1px solid #d1d5db; padding: 10px; text-align: left; }}
            th {{ background-color: #1e3a5f; color: white; }}
            tr:nth-child(even) {{ background-color: #f3f4f6; }}
            .summary {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }}
            .summary-item {{ background: #f8fafc; padding: 15px; border-radius: 8px; }}
            .summary-label {{ color: #6b7280; font-size: 12px; }}
            .summary-value {{ font-size: 24px; font-weight: bold; color: #1e3a5f; }}
            .footer {{ margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }}
        </style>
    </head>
    <body>
        <h1>{team.get('name', 'Team')} - Squad Report</h1>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-label">Tournament</div>
                <div class="summary-value">{tournament.get('name') if tournament else 'N/A'}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Total Budget</div>
                <div class="summary-value">{team.get('budget', 0):,.0f} Pts</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Remaining Budget</div>
                <div class="summary-value">{team.get('remaining_budget', 0):,.0f} Pts</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Players Acquired</div>
                <div class="summary-value">{len(players)}</div>
            </div>
        </div>
        
        <h2>Squad ({len(players)} Players)</h2>
        <table>
            <tr>
                <th>#</th>
                <th>Player Name</th>
                <th>Role</th>
                <th>Purchase Price</th>
                <th>Age</th>
                <th>Matches</th>
            </tr>
    """
    
    for i, player in enumerate(players, 1):
        html_content += f"""
            <tr>
                <td>{i}</td>
                <td>{player.get('name', 'N/A')}</td>
                <td>{player.get('role', 'N/A')}</td>
                <td>{player.get('sold_price', 0):,.0f} Pts</td>
                <td>{player.get('age', 'N/A')}</td>
                <td>{player.get('matches', 0)}</td>
            </tr>
        """
    
    html_content += f"""
        </table>
        
        <div class="footer">
            Generated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | AuctionArena
        </div>
    </body>
    </html>
    """
    
    # Return HTML as downloadable file (can be converted to PDF by browser)
    return Response(
        content=html_content,
        media_type='text/html',
        headers={'Content-Disposition': f'attachment; filename={team.get("short_name", "team")}_report.html'}
    )

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
