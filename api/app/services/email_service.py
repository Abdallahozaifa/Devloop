"""Email service for sending magic links and notifications."""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails."""

    @staticmethod
    def send_magic_link(email: str, token: str) -> bool:
        """Send a magic link login email."""
        login_url = f"{settings.FRONTEND_URL}/auth/verify?token={token}"

        subject = "Login to DevLoop"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #fafafa; padding: 40px; }}
                .container {{ max-width: 500px; margin: 0 auto; }}
                .logo {{ font-size: 24px; font-weight: bold; margin-bottom: 30px; }}
                .logo span {{ background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
                h1 {{ font-size: 20px; margin-bottom: 16px; }}
                p {{ color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; }}
                .footer {{ margin-top: 40px; font-size: 12px; color: #71717a; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo"><span>DevLoop</span></div>
                <h1>Login to DevLoop</h1>
                <p>Click the button below to securely log in to your DevLoop account. This link will expire in 15 minutes.</p>
                <a href="{login_url}" class="button">Login to DevLoop</a>
                <p class="footer">If you didn't request this email, you can safely ignore it.<br>DevLoop - Ship faster. Break nothing.</p>
            </div>
        </body>
        </html>
        """

        return EmailService._send_email(email, subject, html_content)

    @staticmethod
    def send_welcome_email(email: str, license_key: str) -> bool:
        """Send welcome email with license key after purchase."""
        subject = "Welcome to DevLoop! Here's your license key"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #fafafa; padding: 40px; }}
                .container {{ max-width: 500px; margin: 0 auto; }}
                .logo {{ font-size: 24px; font-weight: bold; margin-bottom: 30px; }}
                .logo span {{ background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
                h1 {{ font-size: 20px; margin-bottom: 16px; }}
                p {{ color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; }}
                .license-box {{ background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; margin: 24px 0; }}
                .license-key {{ font-family: monospace; font-size: 18px; color: #22c55e; letter-spacing: 2px; }}
                code {{ background: #27272a; padding: 2px 6px; border-radius: 4px; font-family: monospace; }}
                .footer {{ margin-top: 40px; font-size: 12px; color: #71717a; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo"><span>DevLoop</span></div>
                <h1>Welcome to DevLoop!</h1>
                <p>Thank you for your purchase. Your license key is below:</p>
                <div class="license-box">
                    <div class="license-key">{license_key}</div>
                </div>
                <p>To activate DevLoop, run:</p>
                <p><code>npx create-devloop init</code></p>
                <p>Then enter your license key when prompted.</p>
                <p class="footer">Questions? Reply to this email.<br>DevLoop - Ship faster. Break nothing.</p>
            </div>
        </body>
        </html>
        """

        return EmailService._send_email(email, subject, html_content)

    @staticmethod
    def _send_email(to_email: str, subject: str, html_content: str) -> bool:
        """Send an email using SMTP."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(f"SMTP not configured, would send email to {to_email}: {subject}")
            return True  # Pretend it worked for development

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            msg["To"] = to_email

            html_part = MIMEText(html_content, "html")
            msg.attach(html_part)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

            logger.info(f"Sent email to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
