#!/usr/bin/env python3
"""
Extract Patterns from Repositories
Analyzes cloned repos to extract framework, auth, routes, and structure patterns
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
REPOS_DIR = Path("/tmp/devloop-repos")
OUTPUT_FILE = Path(__file__).parent / "extracted-patterns.json"

# Pattern definitions for extraction
FRAMEWORK_INDICATORS = {
    "fastapi": {
        "files": ["main.py", "app/main.py", "src/main.py"],
        "imports": [r"from\s+fastapi\s+import", r"import\s+fastapi"],
        "patterns": [r"FastAPI\(\)", r"@app\.(get|post|put|delete|patch)"],
    },
    "flask": {
        "files": ["app.py", "application.py", "wsgi.py"],
        "imports": [r"from\s+flask\s+import", r"import\s+flask"],
        "patterns": [r"Flask\(__name__\)", r"@app\.route"],
    },
    "django": {
        "files": ["manage.py", "settings.py", "urls.py"],
        "imports": [r"from\s+django", r"import\s+django"],
        "patterns": [r"INSTALLED_APPS", r"urlpatterns"],
    },
    "express": {
        "files": ["app.js", "server.js", "index.js"],
        "imports": [r"require\(['\"]express['\"]\)", r"from\s+['\"]express['\"]"],
        "patterns": [r"express\(\)", r"app\.(get|post|put|delete|use)"],
    },
    "nextjs": {
        "files": ["next.config.js", "next.config.mjs", "pages/_app.js", "app/layout.tsx"],
        "imports": [r"from\s+['\"]next"],
        "patterns": [r"getServerSideProps", r"getStaticProps"],
    },
    "nestjs": {
        "files": ["nest-cli.json", "src/main.ts", "src/app.module.ts"],
        "imports": [r"from\s+['\"]@nestjs"],
        "patterns": [r"@Module\(", r"@Controller\(", r"@Injectable\("],
    },
}

AUTH_PATTERNS = {
    "jwt": {
        "imports": [r"jwt", r"jose", r"jsonwebtoken", r"python-jose"],
        "patterns": [r"jwt\.encode", r"jwt\.decode", r"JWT", r"Bearer"],
    },
    "oauth": {
        "imports": [r"oauth", r"authlib", r"passport"],
        "patterns": [r"OAuth", r"oauth2", r"authorize_url"],
    },
    "session": {
        "imports": [r"session", r"express-session", r"flask-login"],
        "patterns": [r"session\[", r"login_required", r"@login_required"],
    },
    "magic_link": {
        "patterns": [r"magic.?link", r"passwordless", r"email.?verification"],
    },
}

ROUTE_PATTERNS = {
    "restful": [
        r"@app\.(get|post|put|delete|patch)\(['\"]/?",
        r"router\.(get|post|put|delete|patch)\(['\"]/?",
        r"@router\.(get|post|put|delete|patch)\(['\"]/?",
    ],
    "graphql": [
        r"graphql", r"@Query", r"@Mutation", r"strawberry", r"ariadne",
    ],
}

STRUCTURE_PATTERNS = {
    "monorepo": ["packages/", "apps/", "libs/", "modules/"],
    "src_based": ["src/", "source/"],
    "app_based": ["app/", "application/"],
    "api_folder": ["api/", "backend/", "server/"],
    "frontend_folder": ["frontend/", "client/", "web/"],
}

DEPLOYMENT_PATTERNS = {
    "fly.io": ["fly.toml"],
    "vercel": ["vercel.json", ".vercel/"],
    "railway": ["railway.json", "railway.toml"],
    "heroku": ["Procfile", "app.json"],
    "docker": ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
    "kubernetes": ["k8s/", "kubernetes/", "*.yaml"],
}


def read_file_safe(path: Path, max_size: int = 100000) -> str:
    """Read file safely with size limit"""
    try:
        if path.stat().st_size > max_size:
            return ""
        return path.read_text(errors="ignore")
    except Exception:
        return ""


def find_files(repo_path: Path, patterns: list[str]) -> list[Path]:
    """Find files matching patterns in repo"""
    found = []
    for pattern in patterns:
        if "*" in pattern:
            found.extend(repo_path.rglob(pattern))
        else:
            path = repo_path / pattern
            if path.exists():
                found.append(path)
    return found


def extract_routes(content: str, framework: str) -> list[dict]:
    """Extract API routes from file content"""
    routes = []

    # FastAPI/Flask style decorators
    route_regex = r'@(?:app|router)\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']'
    for match in re.finditer(route_regex, content, re.IGNORECASE):
        routes.append({
            "method": match.group(1).upper(),
            "path": match.group(2),
        })

    # Express style
    express_regex = r'(?:app|router)\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']'
    for match in re.finditer(express_regex, content, re.IGNORECASE):
        routes.append({
            "method": match.group(1).upper(),
            "path": match.group(2),
        })

    return routes


def analyze_repo(repo_path: Path) -> dict:
    """Analyze a single repository for patterns"""
    result = {
        "name": repo_path.name,
        "framework": None,
        "framework_confidence": 0,
        "auth_methods": [],
        "routes": [],
        "structure": [],
        "deployment": [],
        "api_base_paths": [],
        "health_endpoints": [],
    }

    # Detect framework
    for framework, indicators in FRAMEWORK_INDICATORS.items():
        score = 0

        # Check indicator files
        for file_pattern in indicators.get("files", []):
            if (repo_path / file_pattern).exists():
                score += 10

        # Check for imports and patterns in Python/JS files
        for ext in ["*.py", "*.js", "*.ts", "*.tsx"]:
            for file in repo_path.rglob(ext):
                if ".git" in str(file) or "node_modules" in str(file):
                    continue

                content = read_file_safe(file)
                if not content:
                    continue

                for pattern in indicators.get("imports", []):
                    if re.search(pattern, content):
                        score += 5

                for pattern in indicators.get("patterns", []):
                    if re.search(pattern, content):
                        score += 3

                # Extract routes
                routes = extract_routes(content, framework)
                result["routes"].extend(routes)

        if score > result["framework_confidence"]:
            result["framework"] = framework
            result["framework_confidence"] = score

    # Detect auth methods
    for auth_type, patterns in AUTH_PATTERNS.items():
        for ext in ["*.py", "*.js", "*.ts"]:
            for file in repo_path.rglob(ext):
                if ".git" in str(file) or "node_modules" in str(file):
                    continue

                content = read_file_safe(file)
                if not content:
                    continue

                for pattern in patterns.get("imports", []) + patterns.get("patterns", []):
                    if re.search(pattern, content, re.IGNORECASE):
                        if auth_type not in result["auth_methods"]:
                            result["auth_methods"].append(auth_type)
                        break

    # Detect structure
    for structure_type, dirs in STRUCTURE_PATTERNS.items():
        for dir_pattern in dirs:
            if (repo_path / dir_pattern.rstrip("/")).exists():
                if structure_type not in result["structure"]:
                    result["structure"].append(structure_type)

    # Detect deployment
    for platform, files in DEPLOYMENT_PATTERNS.items():
        if find_files(repo_path, files):
            result["deployment"].append(platform)

    # Extract API base paths from routes
    base_paths = set()
    for route in result["routes"]:
        path = route["path"]
        parts = path.split("/")
        if len(parts) >= 2:
            base = "/" + parts[1]
            if parts[1] in ["api", "v1", "v2"]:
                if len(parts) >= 3:
                    base = "/" + "/".join(parts[1:3])
            base_paths.add(base)

    result["api_base_paths"] = list(base_paths)[:10]

    # Detect health endpoints
    health_patterns = ["/health", "/healthz", "/status", "/ping", "/ready", "/live"]
    for route in result["routes"]:
        if route["path"].lower() in health_patterns:
            if route["path"] not in result["health_endpoints"]:
                result["health_endpoints"].append(route["path"])

    # Limit routes to most common
    result["routes"] = result["routes"][:50]

    return result


def aggregate_patterns(repo_results: list[dict]) -> dict:
    """Aggregate patterns from all repos"""
    aggregated = {
        "version": "1.0.0",
        "source": "github-extraction",
        "repos_analyzed": len(repo_results),
        "frameworks": defaultdict(lambda: {"count": 0, "avg_confidence": 0}),
        "auth_methods": defaultdict(int),
        "route_patterns": defaultdict(int),
        "api_base_paths": defaultdict(int),
        "health_endpoints": defaultdict(int),
        "structures": defaultdict(int),
        "deployments": defaultdict(int),
    }

    for result in repo_results:
        # Framework stats
        if result["framework"]:
            fw = result["framework"]
            aggregated["frameworks"][fw]["count"] += 1
            aggregated["frameworks"][fw]["avg_confidence"] += result["framework_confidence"]

        # Auth methods
        for auth in result["auth_methods"]:
            aggregated["auth_methods"][auth] += 1

        # Route patterns (extract path patterns)
        for route in result["routes"]:
            # Normalize path (replace IDs with placeholders)
            path = re.sub(r'/\d+', '/{id}', route["path"])
            path = re.sub(r'/[0-9a-f-]{36}', '/{uuid}', path)
            key = f"{route['method']} {path}"
            aggregated["route_patterns"][key] += 1

        # Base paths
        for path in result["api_base_paths"]:
            aggregated["api_base_paths"][path] += 1

        # Health endpoints
        for endpoint in result["health_endpoints"]:
            aggregated["health_endpoints"][endpoint] += 1

        # Structure
        for structure in result["structure"]:
            aggregated["structures"][structure] += 1

        # Deployment
        for platform in result["deployment"]:
            aggregated["deployments"][platform] += 1

    # Calculate averages
    for fw, data in aggregated["frameworks"].items():
        if data["count"] > 0:
            data["avg_confidence"] = data["avg_confidence"] / data["count"]

    # Convert defaultdicts to regular dicts
    aggregated["frameworks"] = dict(aggregated["frameworks"])
    aggregated["auth_methods"] = dict(aggregated["auth_methods"])
    aggregated["route_patterns"] = dict(sorted(
        aggregated["route_patterns"].items(),
        key=lambda x: x[1],
        reverse=True
    )[:100])
    aggregated["api_base_paths"] = dict(sorted(
        aggregated["api_base_paths"].items(),
        key=lambda x: x[1],
        reverse=True
    )[:20])
    aggregated["health_endpoints"] = dict(sorted(
        aggregated["health_endpoints"].items(),
        key=lambda x: x[1],
        reverse=True
    ))
    aggregated["structures"] = dict(aggregated["structures"])
    aggregated["deployments"] = dict(aggregated["deployments"])

    return aggregated


def main():
    print("=" * 60)
    print("DevLoop Pattern Extractor - Pattern Analysis")
    print("=" * 60)

    if not REPOS_DIR.exists():
        print(f"Error: Repos directory not found: {REPOS_DIR}")
        print("Run scrape-repos.py first!")
        return

    repos = [d for d in REPOS_DIR.iterdir() if d.is_dir() and not d.name.startswith(".")]
    print(f"\nFound {len(repos)} repositories to analyze")

    if not repos:
        print("No repositories found. Run scrape-repos.py first!")
        return

    # Analyze repos in parallel
    results = []
    print("\nAnalyzing repositories...")

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(analyze_repo, repo): repo for repo in repos}

        for i, future in enumerate(as_completed(futures), 1):
            repo = futures[future]
            try:
                result = future.result()
                results.append(result)
                fw = result["framework"] or "unknown"
                print(f"  [{i}/{len(repos)}] {repo.name}: {fw} ({result['framework_confidence']})")
            except Exception as e:
                print(f"  [{i}/{len(repos)}] {repo.name}: ERROR - {e}")

    # Aggregate patterns
    print("\nAggregating patterns...")
    aggregated = aggregate_patterns(results)

    # Save results
    output = {
        "aggregated": aggregated,
        "repos": results,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved to: {OUTPUT_FILE}")

    # Print summary
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)

    print(f"\nRepos analyzed: {aggregated['repos_analyzed']}")

    print("\nFramework Distribution:")
    for fw, data in sorted(aggregated["frameworks"].items(), key=lambda x: x[1]["count"], reverse=True):
        print(f"  {fw}: {data['count']} repos (avg confidence: {data['avg_confidence']:.1f})")

    print("\nAuth Methods:")
    for auth, count in sorted(aggregated["auth_methods"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {auth}: {count} repos")

    print("\nTop API Base Paths:")
    for path, count in list(aggregated["api_base_paths"].items())[:10]:
        print(f"  {path}: {count} repos")

    print("\nHealth Endpoints:")
    for endpoint, count in aggregated["health_endpoints"].items():
        print(f"  {endpoint}: {count} repos")

    print("\nDeployment Platforms:")
    for platform, count in sorted(aggregated["deployments"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {platform}: {count} repos")

    return aggregated


if __name__ == "__main__":
    main()
