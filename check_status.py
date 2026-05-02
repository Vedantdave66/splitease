import urllib.request
import json
import sys

try:
    url = "https://api.github.com/repos/Vedantdave66/splitease/commits/main/status"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"State: {data.get('state')}")
        for status in data.get('statuses', []):
            print(f"- {status.get('context')}: {status.get('state')} ({status.get('target_url')})")
except Exception as e:
    print(f"Error: {e}")
