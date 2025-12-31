from dotenv import load_dotenv
from pymongo import MongoClient
import os
import uuid
from datetime import datetime, timezone
import argparse

ROOT = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT, '.env'))

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'auctiondb')

def create_admin(email: str, name: str = None):
    if not MONGO_URL:
        raise RuntimeError('MONGO_URL not set in .env')

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    # Normalize name
    if not name:
        local = email.split('@')[0]
        name = local.replace('.', ' ').title()

    existing = db.users.find_one({'email': email})
    now = datetime.now(timezone.utc)

    if existing:
        result = db.users.update_one(
            {'email': email},
            {'$set': {
                'role': 'admin',
                'name': name,
                'updated_at': now.isoformat()
            }}
        )
        print(f"Updated existing user {email} to role 'admin'. Modified: {result.modified_count}")
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        doc = {
            'user_id': user_id,
            'email': email,
            'name': name,
            'picture': None,
            'role': 'admin',
            'team_id': None,
            'created_at': now.isoformat(),
        }
        db.users.insert_one(doc)
        print(f"Inserted new admin user {email} with user_id {user_id}")

    # Optional: ensure there's an admin session record (not necessary for admin role)
    client.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create or update an admin user in MongoDB')
    parser.add_argument('--email', required=True, help='Email address for admin user')
    parser.add_argument('--name', required=False, help='Optional full name')
    args = parser.parse_args()

    create_admin(args.email, args.name)
