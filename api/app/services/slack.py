"""Slack notification service for QA alerts."""
import httpx
from datetime import datetime
from typing import Optional

from app.models.project import Project
from app.models.qa_run import QARun, QARunStatus


async def send_slack_notification(
    project: Project,
    qa_run: QARun,
    dashboard_url: str = "https://devloop-landing.fly.dev/dashboard"
) -> bool:
    """Send Slack notification for a QA run result.

    Args:
        project: The project the QA run belongs to
        qa_run: The completed QA run
        dashboard_url: URL to the dashboard for the "View Details" link

    Returns:
        True if notification was sent successfully, False otherwise
    """
    if not project.slack_webhook_url:
        return False

    # Check notification preferences
    is_pass = qa_run.status == QARunStatus.PASSED
    if is_pass and not project.slack_notify_on_pass:
        return False
    if not is_pass and not project.slack_notify_on_fail:
        return False

    # Build the message
    if is_pass:
        color = "#22c55e"  # green
        status_emoji = ":white_check_mark:"
        status_text = "Passed"
    else:
        color = "#ef4444"  # red
        status_emoji = ":x:"
        status_text = "Failed"

    # Calculate duration
    duration = ""
    if qa_run.duration_seconds:
        if qa_run.duration_seconds < 60:
            duration = f"{qa_run.duration_seconds}s"
        else:
            minutes = qa_run.duration_seconds // 60
            seconds = qa_run.duration_seconds % 60
            duration = f"{minutes}m {seconds}s"

    # Build Slack message payload
    payload = {
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"{status_emoji} QA {status_text}: {project.name}",
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {
                                "type": "mrkdwn",
                                "text": f"*Tests Passed:*\n{qa_run.tests_passed}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Tests Failed:*\n{qa_run.tests_failed}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Duration:*\n{duration or 'N/A'}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Run Type:*\n{qa_run.run_type.capitalize()}"
                            }
                        ]
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"Run ID: `{qa_run.id}` | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
                            }
                        ]
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "View Dashboard",
                                    "emoji": True
                                },
                                "url": dashboard_url,
                                "action_id": "view_dashboard"
                            }
                        ]
                    }
                ]
            }
        ]
    }

    # Add failure details if failed
    if not is_pass and qa_run.error_message:
        # Insert error section before context
        payload["attachments"][0]["blocks"].insert(2, {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Error Details:*\n```{qa_run.error_message[:500]}```"
            }
        })

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                project.slack_webhook_url,
                json=payload,
                timeout=10.0
            )
            return response.status_code == 200
    except Exception as e:
        print(f"Error sending Slack notification: {e}")
        return False


async def send_slack_fix_deployed_notification(
    project: Project,
    qa_run: QARun,
    fix_description: str,
    dashboard_url: str = "https://devloop-landing.fly.dev/dashboard"
) -> bool:
    """Send Slack notification when an auto-fix is deployed.

    Args:
        project: The project
        qa_run: The QA run that triggered the fix
        fix_description: Description of what was fixed
        dashboard_url: URL to the dashboard

    Returns:
        True if notification was sent successfully, False otherwise
    """
    if not project.slack_webhook_url:
        return False

    payload = {
        "attachments": [
            {
                "color": "#6366f1",  # indigo
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f":robot_face: Auto-Fix Deployed: {project.name}",
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Fix Applied:*\n{fix_description}"
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"Triggered by QA Run: `{qa_run.id}` | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
                            }
                        ]
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "View Dashboard",
                                    "emoji": True
                                },
                                "url": dashboard_url,
                                "action_id": "view_dashboard"
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
            return response.status_code == 200
    except Exception as e:
        print(f"Error sending Slack notification: {e}")
        return False
