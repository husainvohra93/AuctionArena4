from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

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
    role: str = "team_owner"  # admin or team_owner

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
    budget: float = 10000000  # Default 1 Crore
    owner_email: Optional[str] = None

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
    created_at: datetime

class PlayerCreate(BaseModel):
    name: str
    role: str  # batsman, bowler, all-rounder, wicket-keeper
    base_price: float
    image_url: Optional[str] = None
    age: Optional[int] = None
    batting_style: Optional[str] = None
    bowling_style: Optional[str] = None
    matches: Optional[int] = 0
    runs: Optional[int] = 0
    wickets: Optional[int] = 0

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
    status: str = "unsold"  # unsold, in_auction, sold
    sold_to: Optional[str] = None
    sold_price: Optional[float] = None
    created_at: datetime

class AuctionState(BaseModel):
    auction_id: str
    is_active: bool = False
    current_player_id: Optional[str] = None
    current_bid: float = 0
    current_bidder_id: Optional[str] = None
    current_bidder_name: Optional[str] = None
    bid_history: List[dict] = []
    created_at: datetime

class BidRequest(BaseModel):
    team_id: str
    amount: float

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
    
    # Fetch user data from Emergent Auth
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
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        # Create new user as team_owner by default
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
    
    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Get updated user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Set cookie
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

# ==================== USER MANAGEMENT (Admin) ====================

@api_router.get("/users", response_model=List[dict])
async def get_users(request: Request):
    """Get all users (admin only)"""
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request):
    """Update user role (admin only)"""
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
    """Assign team to user (admin only)"""
    await require_admin(request)
    body = await request.json()
    team_id = body.get("team_id")
    
    # Update user
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"team_id": team_id}}
    )
    
    # Update team owner
    if team_id:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        await db.teams.update_one(
            {"team_id": team_id},
            {"$set": {"owner_id": user_id, "owner_email": user.get("email")}}
        )
    
    return {"message": "Team assigned"}

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
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.teams.insert_one(team_doc)
    del team_doc["_id"] if "_id" in team_doc else None
    
    return await db.teams.find_one({"team_id": team_id}, {"_id": 0})

@api_router.get("/teams")
async def get_teams():
    """Get all teams"""
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
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
            "owner_email": team.owner_email
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
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.players.insert_one(player_doc)
    
    return await db.players.find_one({"player_id": player_id}, {"_id": 0})

@api_router.get("/players")
async def get_players(status: Optional[str] = None):
    """Get all players, optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    
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
            "wickets": player.wickets
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
    
    # Get player's sold_to team first
    player = await db.players.find_one({"player_id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # If player was sold, restore budget to team
    if player.get("sold_to") and player.get("sold_price"):
        await db.teams.update_one(
            {"team_id": player["sold_to"]},
            {
                "$inc": {"remaining_budget": player["sold_price"]},
                "$pull": {"players": player_id}
            }
        )
    
    # Reset player
    await db.players.update_one(
        {"player_id": player_id},
        {"$set": {
            "status": "unsold",
            "sold_to": None,
            "sold_price": None,
            "current_price": 0
        }}
    )
    
    return await db.players.find_one({"player_id": player_id}, {"_id": 0})

# ==================== AUCTION ENDPOINTS ====================

@api_router.get("/auction/state")
async def get_auction_state():
    """Get current auction state"""
    state = await db.auction_state.find_one({}, {"_id": 0})
    
    if not state:
        # Create initial state
        state = {
            "auction_id": f"auction_{uuid.uuid4().hex[:8]}",
            "is_active": False,
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": [],
            "created_at": datetime.now(timezone.utc)
        }
        await db.auction_state.insert_one(state)
        state = await db.auction_state.find_one({}, {"_id": 0})
    
    # Get current player details if in auction
    current_player = None
    if state.get("current_player_id"):
        current_player = await db.players.find_one(
            {"player_id": state["current_player_id"]},
            {"_id": 0}
        )
    
    # Get current bidder team details
    current_bidder_team = None
    if state.get("current_bidder_id"):
        current_bidder_team = await db.teams.find_one(
            {"team_id": state["current_bidder_id"]},
            {"_id": 0}
        )
    
    return {
        **state,
        "current_player": current_player,
        "current_bidder_team": current_bidder_team
    }

@api_router.post("/auction/start")
async def start_auction(request: Request):
    """Start the auction (admin only)"""
    await require_admin(request)
    
    await db.auction_state.update_one(
        {},
        {"$set": {"is_active": True}},
        upsert=True
    )
    
    return await get_auction_state()

@api_router.post("/auction/stop")
async def stop_auction(request: Request):
    """Stop the auction (admin only)"""
    await require_admin(request)
    
    await db.auction_state.update_one(
        {},
        {"$set": {"is_active": False}}
    )
    
    return await get_auction_state()

@api_router.post("/auction/set-player/{player_id}")
async def set_current_player(player_id: str, request: Request):
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
        {"$set": {"status": "in_auction", "current_price": player["base_price"]}}
    )
    
    # Update auction state
    await db.auction_state.update_one(
        {},
        {"$set": {
            "current_player_id": player_id,
            "current_bid": player["base_price"],
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }},
        upsert=True
    )
    
    return await get_auction_state()

@api_router.post("/auction/bid")
async def place_bid(bid: BidRequest, request: Request):
    """Place a bid"""
    user = await require_auth(request)
    
    # Get auction state
    state = await db.auction_state.find_one({}, {"_id": 0})
    if not state or not state.get("is_active"):
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    if not state.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    # Get team
    team = await db.teams.find_one({"team_id": bid.team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if user owns this team or is admin
    if user.get("role") != "admin" and user.get("team_id") != bid.team_id:
        raise HTTPException(status_code=403, detail="You can only bid for your team")
    
    # Check budget
    if bid.amount > team.get("remaining_budget", 0):
        raise HTTPException(status_code=400, detail="Insufficient budget")
    
    # Check if bid is higher than current
    if bid.amount <= state.get("current_bid", 0):
        raise HTTPException(status_code=400, detail="Bid must be higher than current bid")
    
    # Update auction state
    bid_entry = {
        "team_id": bid.team_id,
        "team_name": team["name"],
        "amount": bid.amount,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auction_state.update_one(
        {},
        {
            "$set": {
                "current_bid": bid.amount,
                "current_bidder_id": bid.team_id,
                "current_bidder_name": team["name"]
            },
            "$push": {"bid_history": bid_entry}
        }
    )
    
    # Update player current price
    await db.players.update_one(
        {"player_id": state["current_player_id"]},
        {"$set": {"current_price": bid.amount}}
    )
    
    return await get_auction_state()

@api_router.post("/auction/sell")
async def sell_player(request: Request):
    """Sell current player to highest bidder (admin only)"""
    await require_admin(request)
    
    state = await db.auction_state.find_one({}, {"_id": 0})
    if not state or not state.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    if not state.get("current_bidder_id"):
        raise HTTPException(status_code=400, detail="No bids placed")
    
    player_id = state["current_player_id"]
    team_id = state["current_bidder_id"]
    sold_price = state["current_bid"]
    
    # Update player
    await db.players.update_one(
        {"player_id": player_id},
        {"$set": {
            "status": "sold",
            "sold_to": team_id,
            "sold_price": sold_price,
            "current_price": sold_price
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
    await db.auction_state.update_one(
        {},
        {"$set": {
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }}
    )
    
    return await get_auction_state()

@api_router.post("/auction/unsold")
async def mark_unsold(request: Request):
    """Mark current player as unsold (admin only)"""
    await require_admin(request)
    
    state = await db.auction_state.find_one({}, {"_id": 0})
    if not state or not state.get("current_player_id"):
        raise HTTPException(status_code=400, detail="No player in auction")
    
    # Update player
    await db.players.update_one(
        {"player_id": state["current_player_id"]},
        {"$set": {"status": "unsold", "current_price": 0}}
    )
    
    # Clear auction state
    await db.auction_state.update_one(
        {},
        {"$set": {
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }}
    )
    
    return await get_auction_state()

@api_router.post("/auction/reset")
async def reset_auction(request: Request):
    """Reset entire auction (admin only)"""
    await require_admin(request)
    
    # Reset all players
    await db.players.update_many(
        {},
        {"$set": {
            "status": "unsold",
            "sold_to": None,
            "sold_price": None,
            "current_price": 0
        }}
    )
    
    # Reset all team budgets and players
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
    for team in teams:
        await db.teams.update_one(
            {"team_id": team["team_id"]},
            {"$set": {
                "remaining_budget": team.get("budget", 10000000),
                "players": []
            }}
        )
    
    # Reset auction state
    await db.auction_state.update_one(
        {},
        {"$set": {
            "is_active": False,
            "current_player_id": None,
            "current_bid": 0,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_history": []
        }},
        upsert=True
    )
    
    return {"message": "Auction reset successfully"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(request: Request):
    """Get dashboard statistics"""
    total_players = await db.players.count_documents({})
    sold_players = await db.players.count_documents({"status": "sold"})
    unsold_players = await db.players.count_documents({"status": "unsold"})
    total_teams = await db.teams.count_documents({})
    
    # Total money spent
    sold = await db.players.find({"status": "sold"}, {"_id": 0, "sold_price": 1}).to_list(1000)
    total_spent = sum(p.get("sold_price", 0) or 0 for p in sold)
    
    return {
        "total_players": total_players,
        "sold_players": sold_players,
        "unsold_players": unsold_players,
        "in_auction": await db.players.count_documents({"status": "in_auction"}),
        "total_teams": total_teams,
        "total_spent": total_spent
    }

# ==================== BASIC ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "Cricket Auction API"}

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
