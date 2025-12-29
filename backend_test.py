import requests
import sys
import json
from datetime import datetime

class AuctionArenaAPITester:
    def __init__(self, base_url="https://playermart.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "session_1766994496116"  # Admin session token
        self.tournament_id = "tournament_5bd80821"  # Test tournament ID
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add admin session token for authenticated requests
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 200:
                        print(f"   Response: {response_data}")
                except:
                    pass
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response text: {response.text[:200]}")

            self.results.append({
                "test": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_size": len(response.text) if response.text else 0
            })

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            self.results.append({
                "test": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test basic API health check"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_excel_templates(self):
        """Test Excel template download endpoints"""
        print("\n📊 Testing Excel Template Downloads...")
        
        # Test teams template
        teams_success, _ = self.run_test(
            "Teams Template Download", 
            "GET", 
            "export/teams-template", 
            200
        )
        
        # Test players template  
        players_success, _ = self.run_test(
            "Players Template Download",
            "GET", 
            "export/players-template", 
            200
        )
        
        return teams_success and players_success

    def test_tournament_operations(self):
        """Test tournament CRUD operations"""
        print("\n🏆 Testing Tournament Operations...")
        
        # Get tournaments
        success, tournaments = self.run_test(
            "Get Tournaments",
            "GET",
            "tournaments",
            200
        )
        
        if success and tournaments:
            print(f"   Found {len(tournaments)} tournaments")
            
            # Test specific tournament
            if self.tournament_id:
                tournament_success, tournament = self.run_test(
                    f"Get Tournament {self.tournament_id}",
                    "GET",
                    f"tournaments/{self.tournament_id}",
                    200
                )
                
                if tournament_success and tournament:
                    print(f"   Tournament: {tournament.get('name', 'Unknown')}")
                    return True
        
        return success

    def test_auction_operations(self):
        """Test auction operations for the tournament"""
        print("\n🎯 Testing Auction Operations...")
        
        # Get auctions for tournament
        success, auctions = self.run_test(
            f"Get Auctions for Tournament {self.tournament_id}",
            "GET",
            f"auctions?tournament_id={self.tournament_id}",
            200
        )
        
        if success and auctions:
            print(f"   Found {len(auctions)} auctions")
            
            # Test first auction details if available
            if auctions and len(auctions) > 0:
                auction_id = auctions[0].get('auction_id')
                if auction_id:
                    auction_success, auction_details = self.run_test(
                        f"Get Auction Details {auction_id}",
                        "GET",
                        f"auctions/{auction_id}",
                        200
                    )
                    
                    if auction_success and auction_details:
                        print(f"   Auction: {auction_details.get('name', 'Unknown')}")
                        print(f"   Status: {auction_details.get('status', 'Unknown')}")
                        return True
        
        return success

    def test_teams_and_players(self):
        """Test teams and players for the tournament"""
        print("\n👥 Testing Teams and Players...")
        
        # Get teams
        teams_success, teams = self.run_test(
            f"Get Teams for Tournament {self.tournament_id}",
            "GET",
            f"teams?tournament_id={self.tournament_id}",
            200
        )
        
        # Get players
        players_success, players = self.run_test(
            f"Get Players for Tournament {self.tournament_id}",
            "GET",
            f"players?tournament_id={self.tournament_id}",
            200
        )
        
        if teams_success and teams:
            print(f"   Found {len(teams)} teams")
            
        if players_success and players:
            print(f"   Found {len(players)} players")
            
        return teams_success and players_success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n📈 Testing Dashboard Statistics...")
        
        # Get overall stats
        overall_success, overall_stats = self.run_test(
            "Get Overall Dashboard Stats",
            "GET",
            "stats/dashboard",
            200
        )
        
        # Get tournament-specific stats
        tournament_success, tournament_stats = self.run_test(
            f"Get Tournament Dashboard Stats",
            "GET",
            f"stats/dashboard?tournament_id={self.tournament_id}",
            200
        )
        
        if overall_success and overall_stats:
            print(f"   Total Players: {overall_stats.get('total_players', 0)}")
            print(f"   Sold Players: {overall_stats.get('sold_players', 0)}")
            print(f"   Total Teams: {overall_stats.get('total_teams', 0)}")
            
        return overall_success and tournament_success

    def test_import_export_endpoints(self):
        """Test import/export endpoints structure"""
        print("\n📤 Testing Import/Export Endpoints...")
        
        # Test export endpoints (should work)
        teams_export_success, _ = self.run_test(
            f"Export Teams for Tournament {self.tournament_id}",
            "GET",
            f"export/teams/{self.tournament_id}",
            200
        )
        
        players_export_success, _ = self.run_test(
            f"Export Players for Tournament {self.tournament_id}",
            "GET",
            f"export/players/{self.tournament_id}",
            200
        )
        
        auction_results_success, _ = self.run_test(
            f"Export Auction Results for Tournament {self.tournament_id}",
            "GET",
            f"export/auction-results/{self.tournament_id}",
            200
        )
        
        return teams_export_success and players_export_success and auction_results_success

    def test_auction_pick_mode(self):
        """Test auction pick_mode field functionality"""
        print("\n🎲 Testing Auction Pick Mode...")
        
        # Create auction with manual pick mode
        manual_auction_data = {
            "tournament_id": self.tournament_id,
            "name": "Test Manual Auction",
            "pick_mode": "manual",
            "random_pick_delay": 5
        }
        
        manual_success, manual_auction = self.run_test(
            "Create Auction with Manual Pick Mode",
            "POST",
            "auctions",
            200,
            manual_auction_data
        )
        
        if not manual_success:
            return False
            
        manual_auction_id = manual_auction.get('auction_id')
        
        # Verify pick_mode is returned in GET
        get_success, auction_details = self.run_test(
            f"Get Auction Details - Check Pick Mode",
            "GET",
            f"auctions/{manual_auction_id}",
            200
        )
        
        if get_success and auction_details:
            pick_mode = auction_details.get('pick_mode')
            print(f"   Pick Mode: {pick_mode}")
            if pick_mode != "manual":
                print(f"❌ Expected pick_mode 'manual', got '{pick_mode}'")
                return False
        
        # Create auction with random pick mode
        random_auction_data = {
            "tournament_id": self.tournament_id,
            "name": "Test Random Auction",
            "pick_mode": "random",
            "random_pick_delay": 3
        }
        
        random_success, random_auction = self.run_test(
            "Create Auction with Random Pick Mode",
            "POST",
            "auctions",
            200,
            random_auction_data
        )
        
        if random_success and random_auction:
            random_auction_id = random_auction.get('auction_id')
            
            # Verify random pick mode
            get_random_success, random_details = self.run_test(
                f"Get Random Auction Details - Check Pick Mode",
                "GET",
                f"auctions/{random_auction_id}",
                200
            )
            
            if get_random_success and random_details:
                pick_mode = random_details.get('pick_mode')
                if pick_mode != "random":
                    print(f"❌ Expected pick_mode 'random', got '{pick_mode}'")
                    return False
        
        return manual_success and random_success

    def test_unsold_pool_logic(self):
        """Test unsold pool separation and was_unsold flag"""
        print("\n🔄 Testing Unsold Pool Logic...")
        
        # Get an auction to work with
        success, auctions = self.run_test(
            f"Get Auctions for Unsold Pool Test",
            "GET",
            f"auctions?tournament_id={self.tournament_id}",
            200
        )
        
        if not success or not auctions:
            print("❌ No auctions found for testing")
            return False
            
        auction_id = auctions[0].get('auction_id')
        
        # Get auction details to check pools
        pool_success, auction_details = self.run_test(
            f"Get Auction Details - Check Pools",
            "GET",
            f"auctions/{auction_id}",
            200
        )
        
        if pool_success and auction_details:
            unsold_players = auction_details.get('unsold_players', [])
            reauction_pool = auction_details.get('reauction_pool', [])
            
            print(f"   Fresh Pool (unsold_players): {len(unsold_players)} players")
            print(f"   Re-auction Pool (reauction_pool): {len(reauction_pool)} players")
            
            # Check if pools are properly separated
            if 'unsold_players' not in auction_details:
                print("❌ Missing 'unsold_players' field in auction response")
                return False
                
            if 'reauction_pool' not in auction_details:
                print("❌ Missing 'reauction_pool' field in auction response")
                return False
                
            # Test marking a player as unsold (if there's a current player)
            current_player_id = auction_details.get('current_player_id')
            if current_player_id:
                unsold_success, _ = self.run_test(
                    f"Mark Player as Unsold",
                    "POST",
                    f"auctions/{auction_id}/unsold",
                    200
                )
                
                if unsold_success:
                    # Check if player moved to re-auction pool
                    after_unsold_success, after_details = self.run_test(
                        f"Check Pools After Marking Unsold",
                        "GET",
                        f"auctions/{auction_id}",
                        200
                    )
                    
                    if after_unsold_success and after_details:
                        new_reauction_pool = after_details.get('reauction_pool', [])
                        print(f"   Re-auction Pool after unsold: {len(new_reauction_pool)} players")
                        
                        # Check if the player has was_unsold flag
                        for player in new_reauction_pool:
                            if player.get('player_id') == current_player_id:
                                if not player.get('was_unsold'):
                                    print(f"❌ Player {current_player_id} missing was_unsold flag")
                                    return False
                                break
                
                return unsold_success
        
        return pool_success

    def test_random_pick_functionality(self):
        """Test random pick player endpoint"""
        print("\n🎲 Testing Random Pick Functionality...")
        
        # Get an auction to work with
        success, auctions = self.run_test(
            f"Get Auctions for Random Pick Test",
            "GET",
            f"auctions?tournament_id={self.tournament_id}",
            200
        )
        
        if not success or not auctions:
            print("❌ No auctions found for testing")
            return False
            
        auction_id = auctions[0].get('auction_id')
        
        # Test random pick from fresh pool
        fresh_pick_success, fresh_result = self.run_test(
            f"Random Pick from Fresh Pool",
            "POST",
            f"auctions/{auction_id}/random-pick",
            200
        )
        
        if fresh_pick_success and fresh_result:
            current_player = fresh_result.get('current_player')
            if current_player:
                print(f"   Picked player: {current_player.get('name', 'Unknown')}")
                
                # Clear the current player by marking as unsold to test re-auction pick
                unsold_success, _ = self.run_test(
                    f"Mark Random Picked Player as Unsold",
                    "POST",
                    f"auctions/{auction_id}/unsold",
                    200
                )
                
                if unsold_success:
                    # Test random pick from re-auction pool
                    reauction_pick_success, reauction_result = self.run_test(
                        f"Random Pick from Re-auction Pool",
                        "POST",
                        f"auctions/{auction_id}/random-pick?from_reauction=true",
                        200
                    )
                    
                    if reauction_pick_success and reauction_result:
                        reauction_player = reauction_result.get('current_player')
                        if reauction_player:
                            print(f"   Re-auction picked player: {reauction_player.get('name', 'Unknown')}")
                        return True
        
        return fresh_pick_success

    def test_confetti_trigger(self):
        """Test confetti trigger on player sale"""
        print("\n🎉 Testing Confetti Trigger...")
        
        # Get an auction to work with
        success, auctions = self.run_test(
            f"Get Auctions for Confetti Test",
            "GET",
            f"auctions?tournament_id={self.tournament_id}",
            200
        )
        
        if not success or not auctions:
            print("❌ No auctions found for testing")
            return False
            
        auction_id = auctions[0].get('auction_id')
        
        # Get auction details to check initial state
        initial_success, initial_details = self.run_test(
            f"Get Initial Auction State",
            "GET",
            f"auctions/{auction_id}",
            200
        )
        
        if initial_success and initial_details:
            show_confetti_before = initial_details.get('show_confetti', False)
            last_sold_before = initial_details.get('last_sold_player_id')
            
            print(f"   Initial show_confetti: {show_confetti_before}")
            print(f"   Initial last_sold_player_id: {last_sold_before}")
            
            # Check if there's a current player to sell
            current_player_id = initial_details.get('current_player_id')
            current_bidder_id = initial_details.get('current_bidder_id')
            
            if current_player_id and current_bidder_id:
                # Sell the player
                sell_success, sell_result = self.run_test(
                    f"Sell Player to Trigger Confetti",
                    "POST",
                    f"auctions/{auction_id}/sell",
                    200
                )
                
                if sell_success and sell_result:
                    show_confetti_after = sell_result.get('show_confetti', False)
                    last_sold_after = sell_result.get('last_sold_player_id')
                    
                    print(f"   After sale show_confetti: {show_confetti_after}")
                    print(f"   After sale last_sold_player_id: {last_sold_after}")
                    
                    # Verify confetti is triggered
                    if not show_confetti_after:
                        print("❌ show_confetti should be true after player sale")
                        return False
                        
                    if last_sold_after != current_player_id:
                        print(f"❌ last_sold_player_id should be {current_player_id}, got {last_sold_after}")
                        return False
                        
                    return True
            else:
                print("   No current player with bidder to sell - confetti trigger test skipped")
                return True  # Not a failure, just no data to test with
        
        return initial_success

    def test_reset_auction_clears_was_unsold(self):
        """Test that reset auction clears was_unsold flag"""
        print("\n🔄 Testing Reset Auction Clears was_unsold Flag...")
        
        # Get an auction to work with
        success, auctions = self.run_test(
            f"Get Auctions for Reset Test",
            "GET",
            f"auctions?tournament_id={self.tournament_id}",
            200
        )
        
        if not success or not auctions:
            print("❌ No auctions found for testing")
            return False
            
        auction_id = auctions[0].get('auction_id')
        
        # Get players before reset
        before_success, before_details = self.run_test(
            f"Get Auction Before Reset",
            "GET",
            f"auctions/{auction_id}",
            200
        )
        
        if before_success and before_details:
            reauction_pool_before = before_details.get('reauction_pool', [])
            print(f"   Re-auction pool before reset: {len(reauction_pool_before)} players")
            
            # Reset the auction
            reset_success, reset_result = self.run_test(
                f"Reset Auction",
                "POST",
                f"auctions/{auction_id}/reset",
                200
            )
            
            if reset_success and reset_result:
                reauction_pool_after = reset_result.get('reauction_pool', [])
                print(f"   Re-auction pool after reset: {len(reauction_pool_after)} players")
                
                # Verify re-auction pool is empty after reset
                if len(reauction_pool_after) > 0:
                    print("❌ Re-auction pool should be empty after reset")
                    return False
                    
                # Verify all players have was_unsold=false
                all_players = reset_result.get('unsold_players', [])
                for player in all_players:
                    if player.get('was_unsold', False):
                        print(f"❌ Player {player.get('name')} still has was_unsold=true after reset")
                        return False
                
                print("✅ Reset successfully cleared was_unsold flags")
                return True
        
        return before_success

    def print_summary(self):
        """Print test summary"""
        print(f"\n" + "="*60)
        print(f"🏁 TEST SUMMARY")
        print(f"="*60)
        print(f"📊 Tests Run: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Group results by success/failure
        passed_tests = [r for r in self.results if r['success']]
        failed_tests = [r for r in self.results if not r['success']]
        
        if passed_tests:
            print(f"\n✅ PASSED TESTS ({len(passed_tests)}):")
            for test in passed_tests:
                print(f"   • {test['test']}")
        
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                error_msg = test.get('error', f'Status {test.get("actual_status", "Unknown")}')
                print(f"   • {test['test']} - {error_msg}")

def main():
    print("🚀 Starting AuctionArena Backend API Tests")
    print("="*60)
    
    tester = AuctionArenaAPITester()
    
    # Run all tests
    tests = [
        tester.test_health_check,
        tester.test_excel_templates,
        tester.test_tournament_operations,
        tester.test_auction_operations,
        tester.test_teams_and_players,
        tester.test_dashboard_stats,
        tester.test_import_export_endpoints
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
    
    # Print final summary
    tester.print_summary()
    
    # Return appropriate exit code
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())