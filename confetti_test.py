#!/usr/bin/env python3
"""
Specific test for confetti trigger functionality
"""
import requests
import time

def test_confetti_trigger():
    base_url = "https://playermart.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    session_token = "session_1766994496116"
    tournament_id = "tournament_5bd80821"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {session_token}'
    }
    
    print("🎉 Testing Confetti Trigger Functionality")
    print("=" * 50)
    
    # Get auctions
    response = requests.get(f"{api_url}/auctions?tournament_id={tournament_id}", headers=headers)
    if response.status_code != 200:
        print("❌ Failed to get auctions")
        return False
        
    auctions = response.json()
    if not auctions:
        print("❌ No auctions found")
        return False
        
    auction_id = auctions[0]['auction_id']
    print(f"Using auction: {auction_id}")
    
    # Get teams for bidding
    response = requests.get(f"{api_url}/teams?tournament_id={tournament_id}", headers=headers)
    if response.status_code != 200:
        print("❌ Failed to get teams")
        return False
        
    teams = response.json()
    if not teams:
        print("❌ No teams found")
        return False
        
    team_id = teams[0]['team_id']
    print(f"Using team: {team_id} - {teams[0]['name']}")
    
    # Pick a random player for auction
    response = requests.post(f"{api_url}/auctions/{auction_id}/random-pick", headers=headers)
    if response.status_code != 200:
        print("❌ Failed to pick random player")
        return False
        
    auction_state = response.json()
    current_player = auction_state.get('current_player')
    if not current_player:
        print("❌ No current player after random pick")
        return False
        
    print(f"Picked player: {current_player['name']}")
    
    # Place a bid
    bid_data = {"team_id": team_id}
    response = requests.post(f"{api_url}/auctions/{auction_id}/admin-bid", json=bid_data, headers=headers)
    if response.status_code != 200:
        print("❌ Failed to place bid")
        return False
        
    print("✅ Bid placed successfully")
    
    # Check auction state before sale
    response = requests.get(f"{api_url}/auctions/{auction_id}", headers=headers)
    if response.status_code != 200:
        print("❌ Failed to get auction state")
        return False
        
    before_sale = response.json()
    print(f"Before sale - show_confetti: {before_sale.get('show_confetti', False)}")
    print(f"Before sale - last_sold_player_id: {before_sale.get('last_sold_player_id')}")
    
    # Sell the player
    response = requests.post(f"{api_url}/auctions/{auction_id}/sell", headers=headers)
    if response.status_code != 200:
        print("❌ Failed to sell player")
        return False
        
    after_sale = response.json()
    print(f"After sale - show_confetti: {after_sale.get('show_confetti', False)}")
    print(f"After sale - last_sold_player_id: {after_sale.get('last_sold_player_id')}")
    
    # Verify confetti trigger
    if after_sale.get('show_confetti') != True:
        print("❌ show_confetti should be True after sale")
        return False
        
    if after_sale.get('last_sold_player_id') != current_player['player_id']:
        print("❌ last_sold_player_id should match sold player")
        return False
        
    print("✅ Confetti trigger working correctly!")
    
    # Wait a moment and check if confetti expires
    print("Waiting 6 seconds to test confetti expiration...")
    time.sleep(6)
    
    response = requests.get(f"{api_url}/auctions/{auction_id}", headers=headers)
    if response.status_code == 200:
        expired_state = response.json()
        if expired_state.get('show_confetti') == False:
            print("✅ Confetti correctly expired after 5 seconds")
        else:
            print("⚠️ Confetti still showing after 6 seconds (may be expected)")
    
    return True

if __name__ == "__main__":
    success = test_confetti_trigger()
    exit(0 if success else 1)