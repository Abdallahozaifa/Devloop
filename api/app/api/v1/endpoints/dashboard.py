"""Dashboard endpoints for user data."""
from typing import Annotated, Optional
from datetime import datetime, timedelta
from uuid import UUID
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.project import Project, QASchedule
from app.models.qa_run import QARun, QARunStatus
from app.models.subscription import Subscription, PlanType
from app.models.license import License, LicenseStatus
from app.models.production_test_run import ProductionTestRun
from app.services.production_testing import ProductionTestingService
from app.schemas.production_testing import (
    TriggerProductionTestRequest,
    ProductionTestRunResponse,
    ProductionTestTriggerResponse,
    HealthStatusResponse,
    ProductionTestHistoryResponse,
)

router = APIRouter()


async def require_paid_subscription(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Dependency that requires a paid subscription (not free plan)."""
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = sub_result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=403,
            detail="No subscription found. Please subscribe to access the dashboard."
        )

    if subscription.plan == PlanType.FREE:
        raise HTTPException(
            status_code=403,
            detail="Dashboard access requires a paid subscription. Please upgrade to access this feature."
        )

    if not subscription.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your subscription is not active. Please renew to access the dashboard."
        )

    return current_user


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    api_url: Optional[str] = None
    app_url: Optional[str] = None
    stack: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    api_url: Optional[str] = None
    app_url: Optional[str] = None
    stack: Optional[str] = None
    github_repo: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    slack_notify_on_pass: Optional[bool] = None
    slack_notify_on_fail: Optional[bool] = None
    qa_schedule: Optional[QASchedule] = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    api_url: Optional[str]
    app_url: Optional[str]
    stack: Optional[str]
    github_repo: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    slack_notify_on_pass: bool = False
    slack_notify_on_fail: bool = True
    qa_schedule: QASchedule = QASchedule.NONE
    next_scheduled_run: Optional[datetime] = None
    created_at: datetime
    last_qa_run_at: Optional[datetime]
    last_qa_status: Optional[str] = None

    class Config:
        from_attributes = True


class QARunResponse(BaseModel):
    id: UUID
    project_id: UUID
    status: QARunStatus
    run_type: str
    tests_passed: int
    tests_failed: int
    tests_skipped: int
    created_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    total_projects: int
    total_qa_runs: int
    passed_runs: int
    failed_runs: int
    license_key: Optional[str] = None
    plan: Optional[str] = None
    subscription_active: bool = False


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get dashboard summary for current user. Requires paid subscription."""
    # Count projects
    projects_result = await db.execute(
        select(func.count(Project.id)).where(Project.user_id == current_user.id)
    )
    total_projects = projects_result.scalar() or 0

    # Count QA runs
    runs_result = await db.execute(
        select(func.count(QARun.id))
        .join(Project)
        .where(Project.user_id == current_user.id)
    )
    total_runs = runs_result.scalar() or 0

    passed_result = await db.execute(
        select(func.count(QARun.id))
        .join(Project)
        .where(Project.user_id == current_user.id, QARun.status == QARunStatus.PASSED)
    )
    passed_runs = passed_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count(QARun.id))
        .join(Project)
        .where(Project.user_id == current_user.id, QARun.status == QARunStatus.FAILED)
    )
    failed_runs = failed_result.scalar() or 0

    # Get license
    license_result = await db.execute(
        select(License)
        .where(License.user_id == current_user.id, License.status == LicenseStatus.ACTIVE)
        .limit(1)
    )
    license = license_result.scalar_one_or_none()

    # Get subscription
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = sub_result.scalar_one_or_none()

    return DashboardSummary(
        total_projects=total_projects,
        total_qa_runs=total_runs,
        passed_runs=passed_runs,
        failed_runs=failed_runs,
        license_key=license.key if license else None,
        plan=subscription.plan.value if subscription else None,
        subscription_active=subscription.is_active if subscription else False,
    )


@router.get("/projects", response_model=list[ProjectResponse])
async def get_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get all projects for current user. Requires paid subscription."""
    result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    projects = list(result.scalars().all())

    # Get last QA status for each project
    response = []
    for project in projects:
        last_run_result = await db.execute(
            select(QARun)
            .where(QARun.project_id == project.id)
            .order_by(QARun.created_at.desc())
            .limit(1)
        )
        last_run = last_run_result.scalar_one_or_none()

        response.append(ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            api_url=project.api_url,
            app_url=project.app_url,
            stack=project.stack,
            github_repo=project.github_repo,
            slack_webhook_url=project.slack_webhook_url,
            slack_notify_on_pass=project.slack_notify_on_pass,
            slack_notify_on_fail=project.slack_notify_on_fail,
            qa_schedule=project.qa_schedule,
            next_scheduled_run=project.next_scheduled_run,
            created_at=project.created_at,
            last_qa_run_at=project.last_qa_run_at,
            last_qa_status=last_run.status.value if last_run else None,
        ))

    return response


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    request: ProjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Create a new project. Requires paid subscription."""
    # Check subscription limit
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = sub_result.scalar_one_or_none()

    if not subscription or not subscription.is_active:
        raise HTTPException(status_code=403, detail="No active subscription")

    # Count existing projects
    count_result = await db.execute(
        select(func.count(Project.id)).where(Project.user_id == current_user.id)
    )
    current_count = count_result.scalar() or 0

    if current_count >= subscription.max_projects:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit reached. Upgrade to add more projects."
        )

    # Create project
    project = Project(
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        api_url=request.api_url,
        app_url=request.app_url,
        stack=request.stack,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return project


@router.get("/projects/{project_id}/runs", response_model=list[QARunResponse])
async def get_project_runs(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get QA runs for a project. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get runs
    result = await db.execute(
        select(QARun)
        .where(QARun.project_id == project_id)
        .order_by(QARun.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


def calculate_next_run(schedule: QASchedule) -> Optional[datetime]:
    """Calculate the next scheduled run time based on schedule."""
    if schedule == QASchedule.NONE:
        return None

    now = datetime.utcnow()
    if schedule == QASchedule.HOURLY:
        # Next hour at :00
        return now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    elif schedule == QASchedule.DAILY:
        # Tomorrow at 2 AM UTC
        return now.replace(hour=2, minute=0, second=0, microsecond=0) + timedelta(days=1)
    elif schedule == QASchedule.WEEKLY:
        # Next Monday at 2 AM UTC
        days_until_monday = (7 - now.weekday()) % 7 or 7
        return now.replace(hour=2, minute=0, second=0, microsecond=0) + timedelta(days=days_until_monday)
    return None


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get a single project by ID. Requires paid subscription."""
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get last QA status
    last_run_result = await db.execute(
        select(QARun)
        .where(QARun.project_id == project.id)
        .order_by(QARun.created_at.desc())
        .limit(1)
    )
    last_run = last_run_result.scalar_one_or_none()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        api_url=project.api_url,
        app_url=project.app_url,
        stack=project.stack,
        github_repo=project.github_repo,
        slack_webhook_url=project.slack_webhook_url,
        slack_notify_on_pass=project.slack_notify_on_pass,
        slack_notify_on_fail=project.slack_notify_on_fail,
        qa_schedule=project.qa_schedule,
        next_scheduled_run=project.next_scheduled_run,
        created_at=project.created_at,
        last_qa_run_at=project.last_qa_run_at,
        last_qa_status=last_run.status.value if last_run else None,
    )


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    request: ProjectUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Update project settings. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    # Calculate next scheduled run if schedule changed
    if "qa_schedule" in update_data:
        project.next_scheduled_run = calculate_next_run(project.qa_schedule)

    await db.commit()
    await db.refresh(project)

    # Get last QA status
    last_run_result = await db.execute(
        select(QARun)
        .where(QARun.project_id == project.id)
        .order_by(QARun.created_at.desc())
        .limit(1)
    )
    last_run = last_run_result.scalar_one_or_none()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        api_url=project.api_url,
        app_url=project.app_url,
        stack=project.stack,
        github_repo=project.github_repo,
        slack_webhook_url=project.slack_webhook_url,
        slack_notify_on_pass=project.slack_notify_on_pass,
        slack_notify_on_fail=project.slack_notify_on_fail,
        qa_schedule=project.qa_schedule,
        next_scheduled_run=project.next_scheduled_run,
        created_at=project.created_at,
        last_qa_run_at=project.last_qa_run_at,
        last_qa_status=last_run.status.value if last_run else None,
    )


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Delete a project. Requires paid subscription."""
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()

    return {"message": "Project deleted successfully"}


@router.get("/projects/{project_id}/github-workflow")
async def get_github_workflow(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Generate GitHub Actions workflow for a project. Requires paid subscription."""
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get user's license key
    license_result = await db.execute(
        select(License)
        .where(License.user_id == current_user.id, License.status == LicenseStatus.ACTIVE)
        .limit(1)
    )
    license = license_result.scalar_one_or_none()

    workflow = f'''name: DevLoop QA

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start application
        run: |
          npm start &
          sleep 10  # Wait for app to start

      - name: Run DevLoop QA
        env:
          DEVLOOP_LICENSE_KEY: ${{{{ secrets.DEVLOOP_LICENSE_KEY }}}}
          DEVLOOP_API_URL: {project.api_url or 'http://localhost:8000'}
          DEVLOOP_APP_URL: {project.app_url or 'http://localhost:3000'}
        run: ./scripts/qa.sh all

      - name: Upload QA Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-report
          path: .claude/qa/
'''

    return {
        "workflow": workflow,
        "license_key": license.key if license else None,
        "instructions": [
            "1. Create .github/workflows/devloop.yml in your repository",
            "2. Paste the workflow content below",
            f"3. Add DEVLOOP_LICENSE_KEY secret: {license.key if license else 'Get from dashboard'}",
            "4. Commit and push to trigger the workflow"
        ]
    }


@router.post("/projects/{project_id}/test-slack")
async def test_slack_webhook(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Send a test notification to the project's Slack webhook. Requires paid subscription."""
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.slack_webhook_url:
        raise HTTPException(status_code=400, detail="No Slack webhook URL configured")

    # Send test message
    payload = {
        "attachments": [
            {
                "color": "#6366f1",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f":test_tube: Test Notification: {project.name}",
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "This is a test notification from DevLoop. If you see this, your Slack integration is working correctly!"
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"Sent by: {current_user.email} | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
                            }
                        ]
                    }
                ]
            }
        ]
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                project.slack_webhook_url,
                json=payload,
                timeout=10.0
            )
            if response.status_code == 200:
                return {"success": True, "message": "Test notification sent successfully"}
            else:
                return {"success": False, "message": f"Slack returned status {response.status_code}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")


# =============================================================================
# Production Testing Endpoints
# =============================================================================

@router.post("/projects/{project_id}/production-test", response_model=ProductionTestTriggerResponse)
async def trigger_production_test(
    project_id: UUID,
    request: TriggerProductionTestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Trigger a production test run for a project. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.enable_production_testing:
        raise HTTPException(
            status_code=400,
            detail="Production testing is not enabled for this project. Enable it in project settings."
        )

    if not project.production_url and not project.production_api_url:
        raise HTTPException(
            status_code=400,
            detail="No production URL configured. Set production_url or production_api_url in project settings."
        )

    # Run the test
    service = ProductionTestingService(db)
    test_run = await service.run_full_production_test(project, request.run_type)

    return ProductionTestTriggerResponse(
        id=str(test_run.id),
        status=test_run.status.value,
        run_type=test_run.run_type,
        created_at=test_run.created_at,
        message=f"Production test started. Run ID: {test_run.id}"
    )


@router.get("/projects/{project_id}/production-runs", response_model=ProductionTestHistoryResponse)
async def get_production_test_runs(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get production test run history for a project. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get runs
    service = ProductionTestingService(db)
    runs = await service.get_project_production_runs(str(project_id))

    return ProductionTestHistoryResponse(
        runs=[
            ProductionTestRunResponse(
                id=str(run.id),
                project_id=str(run.project_id),
                status=run.status.value,
                run_type=run.run_type,
                endpoints_tested=run.endpoints_tested,
                endpoints_passed=run.endpoints_passed,
                endpoints_failed=run.endpoints_failed,
                ui_tests_passed=run.ui_tests_passed,
                ui_tests_failed=run.ui_tests_failed,
                api_results=run.api_results,
                ui_results=run.ui_results,
                health_results=run.health_results,
                error_message=run.error_message,
                created_at=run.created_at,
                started_at=run.started_at,
                completed_at=run.completed_at,
                duration_ms=run.duration_ms,
            )
            for run in runs
        ],
        total=len(runs)
    )


@router.get("/projects/{project_id}/production-runs/{run_id}", response_model=ProductionTestRunResponse)
async def get_production_test_run(
    project_id: UUID,
    run_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get a specific production test run. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get the run
    run_result = await db.execute(
        select(ProductionTestRun).where(
            ProductionTestRun.id == run_id,
            ProductionTestRun.project_id == project_id
        )
    )
    run = run_result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Production test run not found")

    return ProductionTestRunResponse(
        id=str(run.id),
        project_id=str(run.project_id),
        status=run.status.value,
        run_type=run.run_type,
        endpoints_tested=run.endpoints_tested,
        endpoints_passed=run.endpoints_passed,
        endpoints_failed=run.endpoints_failed,
        ui_tests_passed=run.ui_tests_passed,
        ui_tests_failed=run.ui_tests_failed,
        api_results=run.api_results,
        ui_results=run.ui_results,
        health_results=run.health_results,
        error_message=run.error_message,
        created_at=run.created_at,
        started_at=run.started_at,
        completed_at=run.completed_at,
        duration_ms=run.duration_ms,
    )


@router.post("/projects/{project_id}/health-check", response_model=HealthStatusResponse)
async def trigger_health_check(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Trigger a manual health check for a project. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.production_url and not project.production_api_url:
        raise HTTPException(
            status_code=400,
            detail="No production URL configured for health checks."
        )

    # Run health check
    service = ProductionTestingService(db)
    result = await service.run_health_check(project)

    return HealthStatusResponse(
        status=result.get("status", "unknown"),
        last_check=project.last_health_check_at,
        response_time_ms=result.get("response_time_ms"),
        endpoint=result.get("endpoint"),
        details=result
    )


@router.get("/projects/{project_id}/health-status", response_model=HealthStatusResponse)
async def get_health_status(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_paid_subscription)],
):
    """Get current health status for a project. Requires paid subscription."""
    # Verify ownership
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return HealthStatusResponse(
        status=project.health_check_status or "unknown",
        last_check=project.last_health_check_at,
        endpoint=project.health_check_endpoint,
        details=None
    )
