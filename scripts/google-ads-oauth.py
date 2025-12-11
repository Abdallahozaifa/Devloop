#!/usr/bin/env /Users/hozaifaabdalla/Desktop/devloop/scripts/.venv/bin/python3
"""
Google Ads OAuth Helper - Get a refresh token for the Google Ads API

Run this first to get your refresh token:
    python scripts/google-ads-oauth.py

Then update ~/Desktop/google_ads_credentials.txt with the refresh token.
"""

import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import requests
import json

# From your credentials file
CLIENT_ID = "252294257522-23bhj3af5t5ibes30cslu3e679sbvn4d.apps.googleusercontent.com"
CLIENT_SECRET = "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"
REDIRECT_URI = "http://localhost:8080"
SCOPES = "https://www.googleapis.com/auth/adwords"

authorization_code = None

class OAuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global authorization_code
        query = parse_qs(urlparse(self.path).query)

        if 'code' in query:
            authorization_code = query['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"""
                <html><body>
                <h1>Authorization successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                </body></html>
            """)
        else:
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            error = query.get('error', ['Unknown error'])[0]
            self.wfile.write(f"<html><body><h1>Error: {error}</h1></body></html>".encode())

    def log_message(self, format, *args):
        pass  # Suppress logging

def get_refresh_token():
    global authorization_code

    # Step 1: Build authorization URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/auth?"
        f"client_id={CLIENT_ID}&"
        f"redirect_uri={REDIRECT_URI}&"
        "response_type=code&"
        f"scope={SCOPES}&"
        "access_type=offline&"
        "prompt=consent"
    )

    print("Opening browser for Google authorization...")
    print(f"\nIf browser doesn't open, visit:\n{auth_url}\n")
    webbrowser.open(auth_url)

    # Step 2: Start local server to receive callback
    print("Waiting for authorization callback...")
    server = HTTPServer(('localhost', 8080), OAuthHandler)
    server.handle_request()

    if not authorization_code:
        print("Error: No authorization code received")
        return None

    print(f"\nAuthorization code received!")

    # Step 3: Exchange code for tokens
    print("Exchanging code for refresh token...")
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        'code': authorization_code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code'
    }

    response = requests.post(token_url, data=data)

    if response.status_code != 200:
        print(f"Error: {response.text}")
        return None

    tokens = response.json()
    refresh_token = tokens.get('refresh_token')

    if refresh_token:
        print("\n" + "="*60)
        print("SUCCESS! Your refresh token:")
        print("="*60)
        print(f"\n{refresh_token}\n")
        print("="*60)
        print("\nUpdate ~/Desktop/google_ads_credentials.txt with:")
        print(f"GOOGLE_ADS_REFRESH_TOKEN={refresh_token}")
        print("="*60)
        return refresh_token
    else:
        print("Error: No refresh token in response")
        print(f"Response: {tokens}")
        return None

if __name__ == "__main__":
    print("Google Ads OAuth Helper")
    print("="*60)
    print("\nThis will help you get a refresh token for Google Ads API.")
    print("Make sure you're signed into the Google account with Ads access.\n")

    get_refresh_token()
