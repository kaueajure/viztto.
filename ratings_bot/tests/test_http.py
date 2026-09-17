import asyncio
import time
import unittest
import httpx
from ratings_bot.http import RateLimitedHTTP, ProviderError


class HTTPTests(unittest.IsolatedAsyncioTestCase):
    async def test_spacing_and_concurrency(self):
        starts, active, maximum = [], 0, 0
        async def handler(request):
            nonlocal active, maximum
            starts.append(time.monotonic())
            active += 1
            maximum = max(maximum, active)
            self.assertIn("VizttoRatingsBot", request.headers["user-agent"])
            await asyncio.sleep(.04)
            active -= 1
            return httpx.Response(200, json={"ok": True})
        client = RateLimitedHTTP(concurrency=2, delay=.025, transport=httpx.MockTransport(handler))
        try:
            await asyncio.gather(*(client.get_json("https://authorized.example/player") for _ in range(4)))
            self.assertLessEqual(maximum, 2)
            self.assertTrue(all(b - a >= .020 for a, b in zip(starts, starts[1:])))
        finally:
            await client.close()

    async def test_429_and_5xx_retry(self):
        for status in (429, 503):
            calls = []
            def handler(request):
                calls.append(time.monotonic())
                return httpx.Response(status if len(calls) == 1 else 200, json={"ok": True}, headers={"Retry-After": "1"})
            client = RateLimitedHTTP(delay=0, transport=httpx.MockTransport(handler))
            try:
                self.assertEqual(await client.get_json("https://authorized.example/player"), {"ok": True})
                self.assertGreaterEqual(calls[1] - calls[0], .99)
            finally:
                await client.close()

    async def test_auth_redirect_and_long_cooldown_stop(self):
        for status in (401, 403, 302, 429):
            calls = []
            def handler(request):
                calls.append(1)
                return httpx.Response(status, headers={"Retry-After": "3600"})
            client = RateLimitedHTTP(delay=0, transport=httpx.MockTransport(handler))
            try:
                with self.assertRaises(ProviderError):
                    await client.get_json("https://authorized.example/player?secret=do-not-log")
                self.assertEqual(len(calls), 1)
            finally:
                await client.close()

    async def test_retry_exhaustion_and_timeout(self):
        async def handler(request):
            raise httpx.ReadTimeout("SECRET")
        client = RateLimitedHTTP(retries=0, transport=httpx.MockTransport(handler))
        try:
            with self.assertRaisesRegex(ProviderError, "transport-failed"):
                await client.get_json("https://authorized.example")
            self.assertEqual(client.requests, 1)
        finally:
            await client.close()
