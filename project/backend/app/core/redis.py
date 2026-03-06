"""
Redis caching layer for Bamboo API.

Provides async get/set/delete helpers backed by a connection pool.
Used by endpoints to cache JSON responses and reduce DB load.
"""
import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

KEY_PREFIX = "bamboo:"


class RedisCache:
    """Async Redis cache wrapper."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def initialize(self) -> None:
        """Create the connection pool."""
        self._redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
        try:
            await self._redis.ping()
            print("✅ Redis cache connected")
        except Exception as e:
            print(f"⚠️ Redis cache connection failed: {e}")
            self._redis = None

    async def close(self) -> None:
        """Close the connection pool."""
        if self._redis:
            await self._redis.close()
            print("🔌 Redis cache closed")

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    async def get(self, key: str) -> Any | None:
        """Return cached value (parsed JSON) or None."""
        if not self._redis:
            return None
        try:
            raw = await self._redis.get(f"{KEY_PREFIX}{key}")
            if raw is not None:
                return json.loads(raw)
        except Exception:
            pass
        return None

    async def set(self, key: str, value: Any, ttl: int = 60) -> None:
        """Store *value* as JSON string with a TTL (seconds)."""
        if not self._redis:
            return
        try:
            await self._redis.set(
                f"{KEY_PREFIX}{key}",
                json.dumps(value, ensure_ascii=False, default=str),
                ex=ttl,
            )
        except Exception:
            pass

    async def delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching *pattern* (glob-style)."""
        if not self._redis:
            return
        try:
            cursor = None
            while cursor != 0:
                cursor, keys = await self._redis.scan(
                    cursor=cursor or 0,
                    match=f"{KEY_PREFIX}{pattern}",
                    count=100,
                )
                if keys:
                    await self._redis.delete(*keys)
        except Exception:
            pass


# Singleton instance – import this in endpoints
cache = RedisCache()
