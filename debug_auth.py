#!/usr/bin/env python3

import requests
import subprocess
import time

def debug_auth():
    print("🔍 Debugging Authentication Issue...")
    
    # Generate unique identifiers
    timestamp = int(time.time())
    user_id = f"test-user-{timestamp}"
    session_token = f"test_session_{timestamp}"
    
    print(f"User ID: {user_id}")
    print(f"Session Token: {session_token}")
    
    # Create test user and session
    mongo_commands = f"""
    use test_database;
    db.users.insertOne({{
        user_id: "{user_id}",
        email: "test.admin.{timestamp}@example.com",
        name: "Test Admin User",
        picture: "https://via.placeholder.com/150",
        role: "admin",
        team_id: null,
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{user_id}",
        session_token: "{session_token}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    """
    
    try:
        result = subprocess.run(
            ['mongosh', '--eval', mongo_commands],
            capture_output=True, text=True, timeout=30
        )
        print(f"MongoDB insert result: {result.returncode}")
        if result.stderr:
            print(f"MongoDB stderr: {result.stderr}")
    except Exception as e:
        print(f"MongoDB error: {e}")
        return
    
    # Verify data was inserted
    verify_commands = f"""
    use test_database;
    print("User:", JSON.stringify(db.users.findOne({{user_id: "{user_id}"}})));
    print("Session:", JSON.stringify(db.user_sessions.findOne({{session_token: "{session_token}"}})));
    """
    
    try:
        result = subprocess.run(
            ['mongosh', '--eval', verify_commands],
            capture_output=True, text=True, timeout=30
        )
        print("MongoDB verification:")
        print(result.stdout)
    except Exception as e:
        print(f"MongoDB verification error: {e}")
    
    # Test API with different auth methods
    api_url = "https://playermart.preview.emergentagent.com/api"
    
    # Test 1: Authorization header
    print("\n🧪 Test 1: Authorization header")
    headers = {'Authorization': f'Bearer {session_token}'}
    try:
        response = requests.get(f"{api_url}/auth/me", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: Cookie
    print("\n🧪 Test 2: Cookie")
    cookies = {'session_token': session_token}
    try:
        response = requests.get(f"{api_url}/auth/me", cookies=cookies, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Both
    print("\n🧪 Test 3: Both header and cookie")
    try:
        response = requests.get(f"{api_url}/auth/me", headers=headers, cookies=cookies, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
        else:
            print(f"Success! Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Cleanup
    cleanup_commands = f"""
    use test_database;
    db.users.deleteOne({{user_id: "{user_id}"}});
    db.user_sessions.deleteOne({{session_token: "{session_token}"}});
    """
    
    try:
        subprocess.run(['mongosh', '--eval', cleanup_commands], timeout=30)
        print("\n🧹 Cleanup completed")
    except Exception as e:
        print(f"Cleanup error: {e}")

if __name__ == "__main__":
    debug_auth()