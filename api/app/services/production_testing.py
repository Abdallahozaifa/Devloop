"""Production testing service for running tests against production environments."""
import httpx
import asyncio
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import Project
from app.models.production_test_run import ProductionTestRun, ProductionTestRunStatus
from app.services.slack import send_slack_notification


class ProductionTestingService:
    """Service for running production tests."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.timeout = 30.0  # Default timeout for HTTP requests

    async def run_health_check(self, project: Project) -> Dict[str, Any]:
        """
        Run a quick health check against the project's production URL.
        Returns health check result dict.
        """
        if not project.production_api_url and not project.production_url:
            return {
                "status": "unknown",
                "error": "No production URL configured"
            }

        base_url = project.production_api_url or project.production_url
        endpoint = project.health_check_endpoint or "/health"
        url = f"{base_url.rstrip('/')}{endpoint}"

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response_time_ms = int((time.time() - start_time) * 1000)

                # Determine health status based on response
                if response.status_code == 200:
                    status = "healthy"
                elif response.status_code < 500:
                    status = "degraded"
                else:
                    status = "down"

                # Try to parse response body as JSON
                body = None
                try:
                    body = response.json()
                except Exception:
                    pass

                # Update project health check status
                project.last_health_check_at = datetime.utcnow()
                project.health_check_status = status
                await self.db.commit()

                return {
                    "endpoint": endpoint,
                    "status_code": response.status_code,
                    "response_time_ms": response_time_ms,
                    "status": status,
                    "body": body
                }

        except httpx.TimeoutException:
            project.last_health_check_at = datetime.utcnow()
            project.health_check_status = "down"
            await self.db.commit()
            return {
                "endpoint": endpoint,
                "status_code": 0,
                "response_time_ms": int((time.time() - start_time) * 1000),
                "status": "down",
                "error": "Request timed out"
            }
        except Exception as e:
            project.last_health_check_at = datetime.utcnow()
            project.health_check_status = "down"
            await self.db.commit()
            return {
                "endpoint": endpoint,
                "status_code": 0,
                "response_time_ms": int((time.time() - start_time) * 1000),
                "status": "down",
                "error": str(e)
            }

    async def run_api_smoke_tests(self, project: Project) -> Dict[str, Any]:
        """
        Run API smoke tests against the project's production API.
        Tests common endpoints like /health, /, /api/v1/status, etc.
        """
        if not project.production_api_url:
            return {
                "endpoints_tested": 0,
                "endpoints_passed": 0,
                "endpoints_failed": 0,
                "results": [],
                "error": "No production API URL configured"
            }

        base_url = project.production_api_url.rstrip('/')

        # Default endpoints to test
        endpoints_to_test = [
            {"path": "/health", "method": "GET", "expected_status": [200]},
            {"path": "/", "method": "GET", "expected_status": [200, 301, 302, 404]},
        ]

        # Add custom health endpoint if different
        if project.health_check_endpoint and project.health_check_endpoint != "/health":
            endpoints_to_test.append({
                "path": project.health_check_endpoint,
                "method": "GET",
                "expected_status": [200]
            })

        results = []
        endpoints_passed = 0
        endpoints_failed = 0

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for endpoint_config in endpoints_to_test:
                path = endpoint_config["path"]
                method = endpoint_config["method"]
                expected_statuses = endpoint_config["expected_status"]
                url = f"{base_url}{path}"

                start_time = time.time()
                try:
                    if method == "GET":
                        response = await client.get(url)
                    elif method == "POST":
                        response = await client.post(url)
                    else:
                        response = await client.request(method, url)

                    response_time_ms = int((time.time() - start_time) * 1000)
                    passed = response.status_code in expected_statuses

                    if passed:
                        endpoints_passed += 1
                    else:
                        endpoints_failed += 1

                    results.append({
                        "endpoint": path,
                        "method": method,
                        "status_code": response.status_code,
                        "response_time_ms": response_time_ms,
                        "passed": passed,
                        "error": None if passed else f"Expected {expected_statuses}, got {response.status_code}"
                    })

                except httpx.TimeoutException:
                    endpoints_failed += 1
                    results.append({
                        "endpoint": path,
                        "method": method,
                        "status_code": 0,
                        "response_time_ms": int((time.time() - start_time) * 1000),
                        "passed": False,
                        "error": "Request timed out"
                    })
                except Exception as e:
                    endpoints_failed += 1
                    results.append({
                        "endpoint": path,
                        "method": method,
                        "status_code": 0,
                        "response_time_ms": int((time.time() - start_time) * 1000),
                        "passed": False,
                        "error": str(e)
                    })

        return {
            "endpoints_tested": len(results),
            "endpoints_passed": endpoints_passed,
            "endpoints_failed": endpoints_failed,
            "results": results
        }

    async def run_ui_tests(self, project: Project) -> Dict[str, Any]:
        """
        Run basic UI tests against the project's production URL.
        Note: Full Playwright testing would require a separate worker service.
        This is a simplified version that checks if the page loads.
        """
        if not project.production_url:
            return {
                "ui_tests_passed": 0,
                "ui_tests_failed": 0,
                "results": [],
                "error": "No production URL configured"
            }

        url = project.production_url
        results = []
        ui_tests_passed = 0
        ui_tests_failed = 0

        # Test 1: Page loads successfully
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(url)
                duration_ms = int((time.time() - start_time) * 1000)

                # Check if page loads (2xx or 3xx status)
                passed = response.status_code < 400

                if passed:
                    ui_tests_passed += 1
                else:
                    ui_tests_failed += 1

                results.append({
                    "test_name": "page_loads",
                    "passed": passed,
                    "duration_ms": duration_ms,
                    "error": None if passed else f"Page returned status {response.status_code}"
                })

                # Test 2: Check content type is HTML
                content_type = response.headers.get("content-type", "")
                is_html = "text/html" in content_type

                if is_html:
                    ui_tests_passed += 1
                else:
                    ui_tests_failed += 1

                results.append({
                    "test_name": "returns_html",
                    "passed": is_html,
                    "duration_ms": 0,
                    "error": None if is_html else f"Expected HTML, got {content_type}"
                })

                # Test 3: Check response time is reasonable (< 5 seconds)
                is_fast = duration_ms < 5000

                if is_fast:
                    ui_tests_passed += 1
                else:
                    ui_tests_failed += 1

                results.append({
                    "test_name": "response_time_acceptable",
                    "passed": is_fast,
                    "duration_ms": duration_ms,
                    "error": None if is_fast else f"Response took {duration_ms}ms (> 5000ms)"
                })

        except httpx.TimeoutException:
            ui_tests_failed += 3
            results.append({
                "test_name": "page_loads",
                "passed": False,
                "duration_ms": int((time.time() - start_time) * 1000),
                "error": "Request timed out"
            })
        except Exception as e:
            ui_tests_failed += 1
            results.append({
                "test_name": "page_loads",
                "passed": False,
                "duration_ms": int((time.time() - start_time) * 1000),
                "error": str(e)
            })

        return {
            "ui_tests_passed": ui_tests_passed,
            "ui_tests_failed": ui_tests_failed,
            "results": results
        }

    async def run_full_production_test(
        self,
        project: Project,
        run_type: str = "full"
    ) -> ProductionTestRun:
        """
        Run a full production test suite and save results.

        Args:
            project: The project to test
            run_type: Type of test to run ('smoke', 'ui', 'health', 'full')

        Returns:
            ProductionTestRun with results
        """
        # Create the test run record
        test_run = ProductionTestRun(
            project_id=project.id,
            run_type=run_type,
            status=ProductionTestRunStatus.RUNNING,
            started_at=datetime.utcnow()
        )
        self.db.add(test_run)
        await self.db.commit()
        await self.db.refresh(test_run)

        start_time = time.time()

        try:
            api_results = {"endpoints_tested": 0, "endpoints_passed": 0, "endpoints_failed": 0, "results": []}
            ui_results = {"ui_tests_passed": 0, "ui_tests_failed": 0, "results": []}
            health_results = {}

            # Run tests based on run_type
            if run_type in ["full", "health"]:
                health_results = await self.run_health_check(project)

            if run_type in ["full", "smoke"]:
                api_results = await self.run_api_smoke_tests(project)

            if run_type in ["full", "ui"]:
                ui_results = await self.run_ui_tests(project)

            # Calculate totals
            endpoints_failed = api_results.get("endpoints_failed", 0)
            ui_tests_failed = ui_results.get("ui_tests_failed", 0)
            health_down = health_results.get("status") == "down" if health_results else False

            # Determine overall status
            if endpoints_failed > 0 or ui_tests_failed > 0 or health_down:
                status = ProductionTestRunStatus.FAILED
            else:
                status = ProductionTestRunStatus.PASSED

            # Update test run with results
            test_run.status = status
            test_run.endpoints_tested = api_results.get("endpoints_tested", 0)
            test_run.endpoints_passed = api_results.get("endpoints_passed", 0)
            test_run.endpoints_failed = endpoints_failed
            test_run.ui_tests_passed = ui_results.get("ui_tests_passed", 0)
            test_run.ui_tests_failed = ui_tests_failed
            test_run.api_results = api_results.get("results", [])
            test_run.ui_results = ui_results.get("results", [])
            test_run.health_results = health_results
            test_run.completed_at = datetime.utcnow()
            test_run.duration_ms = int((time.time() - start_time) * 1000)

            await self.db.commit()
            await self.db.refresh(test_run)

            # Send Slack notification if configured
            if project.slack_webhook_url:
                should_notify = (
                    (status == ProductionTestRunStatus.PASSED and project.slack_notify_on_pass) or
                    (status == ProductionTestRunStatus.FAILED and project.slack_notify_on_fail)
                )
                if should_notify:
                    await self._send_slack_notification(project, test_run)

            return test_run

        except Exception as e:
            # Mark as error if something went wrong
            test_run.status = ProductionTestRunStatus.ERROR
            test_run.error_message = str(e)
            test_run.completed_at = datetime.utcnow()
            test_run.duration_ms = int((time.time() - start_time) * 1000)
            await self.db.commit()
            await self.db.refresh(test_run)
            return test_run

    async def _send_slack_notification(
        self,
        project: Project,
        test_run: ProductionTestRun
    ):
        """Send Slack notification for test results."""
        if not project.slack_webhook_url:
            return

        passed = test_run.status == ProductionTestRunStatus.PASSED
        color = "#22c55e" if passed else "#ef4444"  # green or red
        status_text = "PASSED" if passed else "FAILED"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🧪 Production Test {status_text}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Project:*\n{project.name}"},
                    {"type": "mrkdwn", "text": f"*Run Type:*\n{test_run.run_type}"},
                    {"type": "mrkdwn", "text": f"*API Tests:*\n{test_run.endpoints_passed}/{test_run.endpoints_tested} passed"},
                    {"type": "mrkdwn", "text": f"*UI Tests:*\n{test_run.ui_tests_passed}/{test_run.ui_tests_passed + test_run.ui_tests_failed} passed"},
                    {"type": "mrkdwn", "text": f"*Duration:*\n{test_run.duration_ms}ms"},
                ]
            }
        ]

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    project.slack_webhook_url,
                    json={
                        "attachments": [{
                            "color": color,
                            "blocks": blocks
                        }]
                    }
                )
        except Exception:
            pass  # Don't fail the test run if Slack notification fails

    async def get_project_production_runs(
        self,
        project_id: str,
        limit: int = 50
    ) -> List[ProductionTestRun]:
        """Get production test run history for a project."""
        result = await self.db.execute(
            select(ProductionTestRun)
            .where(ProductionTestRun.project_id == project_id)
            .order_by(ProductionTestRun.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
