#!/usr/bin/env python3
"""
Production Smoke Test for DevLoop API

This script tests all API endpoints against production to catch:
- 500 Internal Server Errors (database issues, SSL problems, etc.)
- Proper authentication/authorization responses
- Database schema mismatches

Run after every deployment:
    python scripts/smoke_test.py --base-url https://devloop-api.fly.dev

For authenticated tests, set environment variables or use --secret-key:
    SECRET_KEY=your-secret python scripts/smoke_test.py --authenticated
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def create_test_token(secret_key: str, user_id: str = "00000000-0000-0000-0000-000000000001") -> str:
    """Create a test JWT token for authenticated endpoint testing."""
    try:
        from jose import jwt
    except ImportError:
        print("WARNING: python-jose not installed. Skipping authenticated tests.")
        print("Install with: pip install python-jose[cryptography]")
        return ""

    expire = datetime.utcnow() + timedelta(minutes=30)
    data = {"sub": user_id, "exp": expire}
    return jwt.encode(data, secret_key, algorithm="HS256")


def test_endpoint(
    base_url: str,
    method: str,
    path: str,
    expected_status: list[int],
    description: str,
    data: Optional[dict] = None,
    auth_token: Optional[str] = None,
    timeout: int = 10
) -> tuple[bool, str, int]:
    """Test a single endpoint and return (passed, message, status_code)."""
    url = f"{base_url}{path}"

    headers = {"Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    body = json.dumps(data).encode() if data else None

    try:
        req = Request(url, data=body, headers=headers, method=method)
        with urlopen(req, timeout=timeout) as response:
            status = response.status
            if status in expected_status:
                return True, f"OK ({status})", status
            else:
                return False, f"Unexpected status {status} (expected {expected_status})", status
    except HTTPError as e:
        status = e.code
        if status in expected_status:
            return True, f"OK ({status})", status
        elif status == 500:
            # Read error body for more details
            try:
                error_body = e.read().decode()[:200]
                return False, f"500 Internal Server Error: {error_body}", status
            except:
                return False, "500 Internal Server Error", status
        else:
            return False, f"HTTP {status} (expected {expected_status})", status
    except URLError as e:
        return False, f"Connection failed: {e.reason}", 0
    except Exception as e:
        return False, f"Error: {str(e)}", 0


def run_smoke_tests(base_url: str, secret_key: Optional[str] = None, verbose: bool = False):
    """Run all smoke tests and return exit code."""

    print(f"\n{'='*60}")
    print(f"DevLoop API Smoke Tests")
    print(f"Target: {base_url}")
    print(f"Time: {datetime.utcnow().isoformat()}Z")
    print(f"{'='*60}\n")

    results = []

    # =========================================
    # PHASE 1: Basic connectivity (no auth)
    # =========================================
    print("PHASE 1: Basic Connectivity Tests")
    print("-" * 40)

    unauthenticated_tests = [
        ("GET", "/health", [200], "Health check"),
        ("GET", "/", [200], "Root endpoint"),
        ("POST", "/api/v1/auth/verify", [400], "Auth verify (invalid token)",
         {"token": "invalid-token"}),
        ("POST", "/api/v1/auth/magic-link", [200, 422], "Magic link (needs email)",
         {"email": "test@example.com"}),
        ("GET", "/api/v1/dashboard/projects", [401, 403], "Dashboard projects (no auth)"),
        ("GET", "/api/v1/billing/subscription", [401, 403], "Billing subscription (no auth)"),
        ("POST", "/api/v1/billing/portal", [401, 403], "Billing portal (no auth)",
         {"return_url": "https://example.com"}),
        ("POST", "/api/v1/billing/checkout", [200, 400, 422], "Billing checkout",
         {"plan": "solo", "success_url": "https://example.com", "cancel_url": "https://example.com"}),
    ]

    for test in unauthenticated_tests:
        method, path, expected, desc = test[:4]
        data = test[4] if len(test) > 4 else None

        passed, msg, status = test_endpoint(base_url, method, path, expected, desc, data)
        results.append((desc, passed, msg, status))

        symbol = "PASS" if passed else "FAIL"
        print(f"  [{symbol}] {desc}: {msg}")

        # Critical failure detection
        if status == 500:
            print(f"    CRITICAL: 500 error detected on {method} {path}")

    # =========================================
    # PHASE 2: Authenticated endpoint tests
    # =========================================
    if secret_key:
        print(f"\nPHASE 2: Authenticated Endpoint Tests")
        print("-" * 40)

        token = create_test_token(secret_key)
        if not token:
            print("  [SKIP] Could not create test token")
        else:
            authenticated_tests = [
                ("GET", "/api/v1/auth/me", [200, 401, 404], "Get current user"),
                ("GET", "/api/v1/dashboard/projects", [200, 401, 403, 404], "Dashboard projects"),
                ("GET", "/api/v1/billing/subscription", [200, 401, 403], "Billing subscription"),
                ("POST", "/api/v1/billing/portal", [200, 400, 401, 403], "Billing portal",
                 {"return_url": "https://example.com"}),
            ]

            for test in authenticated_tests:
                method, path, expected, desc = test[:4]
                data = test[4] if len(test) > 4 else None

                passed, msg, status = test_endpoint(
                    base_url, method, path, expected, desc, data, auth_token=token
                )
                results.append((desc + " (auth)", passed, msg, status))

                symbol = "PASS" if passed else "FAIL"
                print(f"  [{symbol}] {desc}: {msg}")

                if status == 500:
                    print(f"    CRITICAL: 500 error on authenticated {method} {path}")
    else:
        print(f"\nPHASE 2: Authenticated Endpoint Tests")
        print("-" * 40)
        print("  [SKIP] No SECRET_KEY provided. Set --secret-key or SECRET_KEY env var.")

    # =========================================
    # Summary
    # =========================================
    print(f"\n{'='*60}")
    print("SUMMARY")
    print("=" * 60)

    total = len(results)
    passed = sum(1 for r in results if r[1])
    failed = total - passed
    critical_500s = sum(1 for r in results if r[3] == 500)

    print(f"Total: {total} | Passed: {passed} | Failed: {failed}")

    if critical_500s > 0:
        print(f"\nCRITICAL: {critical_500s} endpoint(s) returning 500 errors!")
        print("This indicates a server-side issue that needs immediate attention.")

    if failed > 0:
        print(f"\nFailed tests:")
        for desc, passed, msg, status in results:
            if not passed:
                print(f"  - {desc}: {msg}")

    print()

    # Exit with error if any 500s or failures
    if critical_500s > 0:
        return 2  # Critical failure
    elif failed > 0:
        return 1  # Test failure
    return 0  # Success


def main():
    parser = argparse.ArgumentParser(description="DevLoop API Smoke Tests")
    parser.add_argument(
        "--base-url",
        default="https://devloop-api.fly.dev",
        help="Base URL of the API (default: https://devloop-api.fly.dev)"
    )
    parser.add_argument(
        "--secret-key",
        default=None,
        help="Secret key for generating test JWT tokens (for authenticated tests)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    # Try to get secret key from environment if not provided
    import os
    secret_key = args.secret_key or os.environ.get("SECRET_KEY")

    exit_code = run_smoke_tests(args.base_url, secret_key, args.verbose)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
