#!/usr/bin/env python3
"""
Scrape Top Python Web Repos from GitHub
Downloads top 100 Python web framework repos for pattern extraction
"""

import os
import json
import subprocess
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Configuration
REPOS_DIR = Path("/tmp/devloop-repos")
OUTPUT_FILE = Path(__file__).parent / "repo-list.json"
MAX_REPOS = 100
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# Search queries for different web frameworks
SEARCH_QUERIES = [
    "language:python topic:fastapi",
    "language:python topic:flask",
    "language:python topic:django",
    "language:python fastapi in:readme",
    "language:python flask in:readme",
    "language:python django in:readme",
    "language:python topic:web-api",
    "language:python topic:rest-api",
    "language:javascript topic:nextjs",
    "language:javascript topic:react",
    "language:javascript topic:express",
    "language:typescript topic:nestjs",
]

def get_headers():
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def search_repos(query: str, per_page: int = 30) -> list:
    """Search GitHub for repos matching query"""
    url = "https://api.github.com/search/repositories"
    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": per_page
    }

    try:
        response = requests.get(url, headers=get_headers(), params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("items", [])
    except Exception as e:
        print(f"  Error searching '{query}': {e}")
        return []

def clone_repo(repo: dict) -> dict:
    """Clone a repo shallowly"""
    clone_url = repo["clone_url"]
    repo_name = repo["full_name"].replace("/", "_")
    dest = REPOS_DIR / repo_name

    if dest.exists():
        return {"name": repo_name, "path": str(dest), "status": "exists"}

    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", "--single-branch", clone_url, str(dest)],
            capture_output=True,
            timeout=120,
            check=True
        )
        return {"name": repo_name, "path": str(dest), "status": "cloned"}
    except subprocess.TimeoutExpired:
        return {"name": repo_name, "path": None, "status": "timeout"}
    except subprocess.CalledProcessError as e:
        return {"name": repo_name, "path": None, "status": f"error: {e.stderr.decode()[:100]}"}

def main():
    print("=" * 60)
    print("DevLoop Pattern Extractor - GitHub Scraper")
    print("=" * 60)

    # Create repos directory
    REPOS_DIR.mkdir(parents=True, exist_ok=True)

    # Collect repos from all queries
    all_repos = {}

    for query in SEARCH_QUERIES:
        print(f"\nSearching: {query}")
        repos = search_repos(query, per_page=20)
        print(f"  Found {len(repos)} repos")

        for repo in repos:
            full_name = repo["full_name"]
            if full_name not in all_repos:
                all_repos[full_name] = {
                    "full_name": full_name,
                    "clone_url": repo["clone_url"],
                    "html_url": repo["html_url"],
                    "stars": repo["stargazers_count"],
                    "language": repo["language"],
                    "description": repo.get("description", ""),
                    "topics": repo.get("topics", []),
                }

        # Rate limit
        time.sleep(1)

    # Sort by stars and take top N
    sorted_repos = sorted(all_repos.values(), key=lambda x: x["stars"], reverse=True)[:MAX_REPOS]

    print(f"\n\nCollected {len(sorted_repos)} unique repos (top by stars)")
    print("=" * 60)

    # Save repo list
    with open(OUTPUT_FILE, "w") as f:
        json.dump(sorted_repos, f, indent=2)
    print(f"Saved repo list to {OUTPUT_FILE}")

    # Clone repos in parallel
    print(f"\nCloning {len(sorted_repos)} repos to {REPOS_DIR}...")

    cloned = 0
    failed = 0
    skipped = 0

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(clone_repo, repo): repo for repo in sorted_repos}

        for future in as_completed(futures):
            result = future.result()
            if result["status"] == "cloned":
                cloned += 1
                print(f"  ✓ Cloned: {result['name']}")
            elif result["status"] == "exists":
                skipped += 1
                print(f"  - Exists: {result['name']}")
            else:
                failed += 1
                print(f"  ✗ Failed: {result['name']} ({result['status']})")

    print("\n" + "=" * 60)
    print(f"Summary: {cloned} cloned, {skipped} existed, {failed} failed")
    print(f"Repos stored in: {REPOS_DIR}")
    print("=" * 60)

    return sorted_repos

if __name__ == "__main__":
    main()
