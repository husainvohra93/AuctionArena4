from dotenv import load_dotenv
from pymongo import MongoClient
import os
import argparse

ROOT = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT, '.env'))
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'auctiondb')

parser = argparse.ArgumentParser()
parser.add_argument('--email', required=True)
args = parser.parse_args()

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
user = db.users.find_one({'email': args.email})
if not user:
    print('No user')
else:
    sessions = list(db.user_sessions.find({'user_id': user['user_id']}))
    for s in sessions:
        print(s)
client.close()