#!/usr/bin/env python3
"""
Aggregate Patterns into DevLoop Format
Converts extracted patterns into the learned-patterns.json format
"""

import json
from pathlib import Path

EXTRACTED_FILE = Path(__file__).parent / "extracted-patterns.json"
OUTPUT_FILE = Path(__file__).parent.parent / "packages/devloop-cli/src/data/learned-patterns.json"


def main():
    print("=" * 60)
    print("DevLoop Pattern Aggregator")
    print("=" * 60)

    if not EXTRACTED_FILE.exists():
        print(f"Error: Extracted patterns not found: {EXTRACTED_FILE}")
        print("Run extract-patterns.py first!")
        return

    with open(EXTRACTED_FILE) as f:
        data = json.load(f)

    aggregated = data["aggregated"]

    # Build learned patterns structure
    learned = {
        "version": "1.0.0",
        "source": "github-100-repos",
        "lastUpdated": "auto-generated",
        "stats": {
            "reposAnalyzed": aggregated["repos_analyzed"],
        },

        # Framework detection patterns (from real repos)
        "frameworkIndicators": {},

        # Auth method patterns
        "authPatterns": {},

        # API route patterns (most common)
        "routePatterns": [],

        # API base paths (ranked by frequency)
        "apiBasePaths": [],

        # Health endpoints (ranked by frequency)
        "healthEndpoints": [],

        # Directory structure patterns
        "structurePatterns": {},

        # Deployment patterns
        "deploymentPatterns": {},
    }

    # Framework indicators
    for fw, stats in aggregated["frameworks"].items():
        learned["frameworkIndicators"][fw] = {
            "frequency": stats["count"],
            "avgConfidence": round(stats["avg_confidence"], 1),
        }

    # Auth patterns
    total_repos = aggregated["repos_analyzed"]
    for auth, count in aggregated["auth_methods"].items():
        learned["authPatterns"][auth] = {
            "frequency": count,
            "percentage": round(count / total_repos * 100, 1),
        }

    # Route patterns (top 50)
    for route, count in list(aggregated["route_patterns"].items())[:50]:
        parts = route.split(" ", 1)
        if len(parts) == 2:
            learned["routePatterns"].append({
                "method": parts[0],
                "path": parts[1],
                "frequency": count,
            })

    # API base paths
    for path, count in aggregated["api_base_paths"].items():
        learned["apiBasePaths"].append({
            "path": path,
            "frequency": count,
            "percentage": round(count / total_repos * 100, 1),
        })

    # Sort by frequency
    learned["apiBasePaths"].sort(key=lambda x: x["frequency"], reverse=True)

    # Health endpoints
    for endpoint, count in aggregated["health_endpoints"].items():
        learned["healthEndpoints"].append({
            "path": endpoint,
            "frequency": count,
        })

    learned["healthEndpoints"].sort(key=lambda x: x["frequency"], reverse=True)

    # Structure patterns
    for structure, count in aggregated["structures"].items():
        learned["structurePatterns"][structure] = {
            "frequency": count,
            "percentage": round(count / total_repos * 100, 1),
        }

    # Deployment patterns
    for platform, count in aggregated["deployments"].items():
        learned["deploymentPatterns"][platform] = {
            "frequency": count,
            "percentage": round(count / total_repos * 100, 1),
        }

    # Save to output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(learned, f, indent=2)

    print(f"\nSaved learned patterns to: {OUTPUT_FILE}")

    # Print summary
    print("\n" + "=" * 60)
    print("LEARNED PATTERNS SUMMARY")
    print("=" * 60)

    print(f"\nFrameworks detected: {len(learned['frameworkIndicators'])}")
    print(f"Auth patterns: {len(learned['authPatterns'])}")
    print(f"Route patterns: {len(learned['routePatterns'])}")
    print(f"API base paths: {len(learned['apiBasePaths'])}")
    print(f"Health endpoints: {len(learned['healthEndpoints'])}")

    print("\nTop API Base Paths:")
    for item in learned["apiBasePaths"][:5]:
        print(f"  {item['path']}: {item['frequency']} repos ({item['percentage']}%)")

    print("\nTop Health Endpoints:")
    for item in learned["healthEndpoints"][:5]:
        print(f"  {item['path']}: {item['frequency']} repos")


if __name__ == "__main__":
    main()
