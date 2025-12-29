#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime, timezone, timedelta

class CricketAuctionAPITester:
    def __init__(self, base_url="https://cricket-mart-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "admin_session_test"  # Use provided session token
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.passed_tests = []
        # Test data IDs from agent context
        self.tournament_id = "tournament_9dc6c123"
        self.auction_id = "auction_be5bca0c"

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            self.passed_tests.append(test_name)
            print(f"✅ {test_name} - PASSED")
        else:
            self.failed_tests.append({"test": test_name, "details": details})
            print(f"❌ {test_name} - FAILED: {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request with authentication"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            return success, response
        except Exception as e:
            return False, str(e)

    def setup_test_user(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Setting up test user and session...")
        
        # Generate unique identifiers
        timestamp = int(time.time())
        self.user_id = f"test-user-{timestamp}"
        self.session_token = f"test_session_{timestamp}"
        
        # MongoDB commands to create test user and session
        mongo_commands = f"""
        use test_database;
        db.users.insertOne({{
            user_id: "{self.user_id}",
            email: "test.admin.{timestamp}@example.com",
            name: "Test Admin User",
            picture: "https://via.placeholder.com/150",
            role: "admin",
            team_id: null,
            created_at: new Date()
        }});
        db.user_sessions.insertOne({{
            user_id: "{self.user_id}",
            session_token: "{self.session_token}",
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        """
        
        try:
            import subprocess
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode == 0:
                print(f"✅ Test user created: {self.user_id}")
                print(f"✅ Session token: {self.session_token}")
                return True
            else:
                print(f"❌ MongoDB setup failed: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ MongoDB setup error: {str(e)}")
            return False

    def test_health_check(self):
        """Test basic API health"""
        success, response = self.make_request('GET', '', expected_status=200)
        if success:
            try:
                data = response.json()
                if data.get('message') == 'Cricket Auction API':
                    self.log_result("API Health Check", True)
                else:
                    self.log_result("API Health Check", False, f"Unexpected response: {data}")
            except:
                self.log_result("API Health Check", False, "Invalid JSON response")
        else:
            self.log_result("API Health Check", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_auth_me(self):
        """Test authentication endpoint"""
        success, response = self.make_request('GET', 'auth/me', expected_status=200)
        if success:
            try:
                user_data = response.json()
                if user_data.get('user_id') == self.user_id and user_data.get('role') == 'admin':
                    self.log_result("Auth Me Endpoint", True)
                else:
                    self.log_result("Auth Me Endpoint", False, f"User data mismatch: {user_data}")
            except:
                self.log_result("Auth Me Endpoint", False, "Invalid JSON response")
        else:
            self.log_result("Auth Me Endpoint", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_teams_crud(self):
        """Test teams CRUD operations"""
        # Test GET teams
        success, response = self.make_request('GET', 'teams', expected_status=200)
        if success:
            self.log_result("Get Teams", True)
            teams = response.json()
        else:
            self.log_result("Get Teams", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test CREATE team
        team_data = {
            "name": "Test Team Mumbai",
            "short_name": "TTM",
            "logo_url": "https://via.placeholder.com/100",
            "budget": 10000000,
            "owner_email": "test.owner@example.com"
        }
        
        success, response = self.make_request('POST', 'teams', data=team_data, expected_status=200)
        if success:
            try:
                created_team = response.json()
                team_id = created_team.get('team_id')
                if team_id and created_team.get('name') == team_data['name']:
                    self.log_result("Create Team", True)
                    self.test_team_id = team_id
                else:
                    self.log_result("Create Team", False, f"Invalid team data: {created_team}")
            except:
                self.log_result("Create Team", False, "Invalid JSON response")
        else:
            self.log_result("Create Team", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_players_crud(self):
        """Test players CRUD operations"""
        # Test GET players
        success, response = self.make_request('GET', 'players', expected_status=200)
        if success:
            self.log_result("Get Players", True)
        else:
            self.log_result("Get Players", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test CREATE player
        player_data = {
            "name": "Test Player Virat",
            "role": "batsman",
            "base_price": 2000000,
            "image_url": "https://via.placeholder.com/300x400",
            "age": 28,
            "batting_style": "right-handed",
            "bowling_style": None,
            "matches": 50,
            "runs": 2500,
            "wickets": 0
        }
        
        success, response = self.make_request('POST', 'players', data=player_data, expected_status=200)
        if success:
            try:
                created_player = response.json()
                player_id = created_player.get('player_id')
                if player_id and created_player.get('name') == player_data['name']:
                    self.log_result("Create Player", True)
                    self.test_player_id = player_id
                else:
                    self.log_result("Create Player", False, f"Invalid player data: {created_player}")
            except:
                self.log_result("Create Player", False, "Invalid JSON response")
        else:
            self.log_result("Create Player", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_auction_state(self):
        """Test auction state endpoint"""
        success, response = self.make_request('GET', 'auction/state', expected_status=200)
        if success:
            try:
                auction_data = response.json()
                if 'auction_id' in auction_data and 'is_active' in auction_data:
                    self.log_result("Auction State", True)
                else:
                    self.log_result("Auction State", False, f"Missing required fields: {auction_data}")
            except:
                self.log_result("Auction State", False, "Invalid JSON response")
        else:
            self.log_result("Auction State", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.make_request('GET', 'stats/dashboard', expected_status=200)
        if success:
            try:
                stats = response.json()
                required_fields = ['total_players', 'sold_players', 'unsold_players', 'total_teams', 'total_spent']
                if all(field in stats for field in required_fields):
                    self.log_result("Dashboard Stats", True)
                else:
                    self.log_result("Dashboard Stats", False, f"Missing required fields: {stats}")
            except:
                self.log_result("Dashboard Stats", False, "Invalid JSON response")
        else:
            self.log_result("Dashboard Stats", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_auction_controls(self):
        """Test auction control endpoints"""
        # Test start auction
        success, response = self.make_request('POST', 'auction/start', data={}, expected_status=200)
        if success:
            self.log_result("Start Auction", True)
        else:
            self.log_result("Start Auction", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

        # Test stop auction
        success, response = self.make_request('POST', 'auction/stop', data={}, expected_status=200)
        if success:
            self.log_result("Stop Auction", True)
        else:
            self.log_result("Stop Auction", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_users_endpoint(self):
        """Test users management endpoint"""
        success, response = self.make_request('GET', 'users', expected_status=200)
        if success:
            try:
                users = response.json()
                if isinstance(users, list):
                    self.log_result("Get Users", True)
                else:
                    self.log_result("Get Users", False, f"Expected list, got: {type(users)}")
            except:
                self.log_result("Get Users", False, "Invalid JSON response")
        else:
            self.log_result("Get Users", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        mongo_commands = f"""
        use test_database;
        db.users.deleteOne({{user_id: "{self.user_id}"}});
        db.user_sessions.deleteOne({{session_token: "{self.session_token}"}});
        db.teams.deleteMany({{name: /^Test Team/}});
        db.players.deleteMany({{name: /^Test Player/}});
        """
        
        try:
            import subprocess
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode == 0:
                print("✅ Test data cleaned up")
            else:
                print(f"⚠️ Cleanup warning: {result.stderr}")
        except Exception as e:
            print(f"⚠️ Cleanup error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Cricket Auction API Tests")
        print(f"🎯 Testing against: {self.base_url}")
        print("=" * 60)

        # Setup
        if not self.setup_test_user():
            print("❌ Failed to setup test user. Aborting tests.")
            return False

        # Run tests
        self.test_health_check()
        self.test_auth_me()
        self.test_teams_crud()
        self.test_players_crud()
        self.test_auction_state()
        self.test_dashboard_stats()
        self.test_auction_controls()
        self.test_users_endpoint()

        # Cleanup
        self.cleanup_test_data()

        # Results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['details']}")
        
        if self.passed_tests:
            print(f"\n✅ Passed Tests: {', '.join(self.passed_tests)}")

        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n🎯 Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80

def main():
    tester = CricketAuctionAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())