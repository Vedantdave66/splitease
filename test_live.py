import httpx
import asyncio

async def test_live():
    async with httpx.AsyncClient(follow_redirects=True) as client:
        data = {
            "email": "vedantdave9@gmail.com",
            "password": "password123"
        }
        # Try POST to login
        res = await client.post("https://tandempay.ca/_/backend/api/auth/login", json=data)
        print("Status:", res.status_code)
        print("Body:", res.text)

asyncio.run(test_live())
