from pymongo import MongoClient
from typing import List, Dict, Any

MONGO_URI = 'mongodb://127.0.0.1:27017/zombie_coop'
_client: MongoClient | None = None


def _get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client['zombie_coop']


def save_telemetry(data: Dict[str, Any]):
    db = _get_db()
    db['telemetry'].insert_one(data)


def get_telemetry_samples(limit: int = 5000) -> List[Dict[str, Any]]:
    db = _get_db()
    cursor = db['telemetry'].find(
        {},
        {'wave': 1, 'apm': 1, 'avgAccuracy': 1, 'hpLossRate': 1, 'clearTime': 1, '_id': 0}
    ).limit(limit)
    return list(cursor)


def get_sample_count() -> int:
    return _get_db()['telemetry'].count_documents({})
