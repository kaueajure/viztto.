"""Transport for future authorized APIs; never bypasses protection or redirects."""
from __future__ import annotations
import asyncio
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import httpx as httpx_types


def _httpx():
    try:
        import httpx
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "httpx is required for network transport. "
            "Install with: .venv-ratings/bin/pip install -e '.[test]'"
        ) from exc
    return httpx


class ProviderError(Exception):
    """Safe error code only: never response bodies, URLs or credentials."""


class RateLimitedHTTP:
    def __init__(self, *, concurrency: int = 1, delay: float = 1.5,
                 timeout: float = 20, retries: int = 3,
                 transport: Any = None):
        httpx = _httpx()
        if concurrency < 1 or delay < 0 or timeout <= 0 or not 0 <= retries <= 5:
            raise ValueError("Invalid transport limits")
        self.semaphore = asyncio.Semaphore(concurrency)
        self.lock = asyncio.Lock()
        self.delay, self.retries = delay, retries
        self.next_start = 0.0
        self.requests = self.errors = 0
        self._httpx = httpx
        self.client = httpx.AsyncClient(timeout=timeout, transport=transport,
            follow_redirects=False, headers={"User-Agent": "VizttoRatingsBot/1.0 (offline importer)"})

    async def close(self) -> None:
        await self.client.aclose()

    async def get_json(self, url: str, *, headers: dict | None = None) -> dict:
        httpx = self._httpx
        for attempt in range(self.retries + 1):
            retry_delay = 2 ** attempt
            async with self.semaphore:
                async with self.lock:
                    await asyncio.sleep(max(0, self.next_start - time.monotonic()))
                    self.next_start = time.monotonic() + self.delay
                try:
                    self.requests += 1
                    response = await self.client.get(url, headers=headers)
                except (httpx.TimeoutException, httpx.TransportError):
                    self.errors += 1
                    if attempt == self.retries:
                        raise ProviderError("transport-failed") from None
                else:
                    if response.status_code == 200:
                        try:
                            return response.json()
                        except ValueError:
                            raise ProviderError("invalid-json") from None
                    self.errors += 1
                    if response.status_code != 429 and not 500 <= response.status_code < 600:
                        raise ProviderError(f"http-{response.status_code}")
                    value = response.headers.get("Retry-After")
                    if value:
                        try:
                            retry_delay = max(retry_delay, float(value))
                        except ValueError:
                            try:
                                retry_delay = max(retry_delay, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
                            except (ValueError, TypeError):
                                pass
                    # Long cooldown: stop the provider rather than retry too early.
                    if retry_delay > 60 or attempt == self.retries:
                        raise ProviderError("retry-exhausted")
                    async with self.lock:
                        self.next_start = max(self.next_start, time.monotonic() + retry_delay)
            await asyncio.sleep(retry_delay)
        raise ProviderError("retry-exhausted")
