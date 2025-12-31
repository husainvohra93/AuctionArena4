from dotenv import load_dotenv
from pymongo import MongoClient
import os
import uuid
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT, '.env'))

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'auctiondb')

if not MONGO_URL:
    raise RuntimeError('MONGO_URL not set in .env')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--email', required=True)
args = parser.parse_args()

user = db.users.find_one({'email': args.email})
if not user:
    raise RuntimeError(f'No user with email {args.email} found')

session_token = f'session_{uuid.uuid4().hex[:24]}'
expires_at = datetime.now(timezone.utc) + timedelta(days=7)

db.user_sessions.insert_one({
    'user_id': user['user_id'],
    'session_token': session_token,
    'expires_at': expires_at.isoformat(),
    'created_at': datetime.now(timezone.utc).isoformat()
})

print(session_token)
client.close()