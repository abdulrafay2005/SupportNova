import os
import ssl
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()


SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM") or SMTP_USERNAME


def send_email(
    to_email: str,
    subject: str,
    body: str
) -> bool:

    # Email is optional. Do not break application flow
    # when SMTP has not been configured yet.
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not MAIL_FROM:
        print("SMTP not configured. Email was not sent.")
        return False

    message = EmailMessage()

    message["From"] = MAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject

    message.set_content(body)

    try:

        if SMTP_PORT == 465:

            # SSL connection
            context = ssl.create_default_context()

            with smtplib.SMTP_SSL(
                SMTP_HOST,
                SMTP_PORT,
                context=context,
                timeout=10
            ) as server:

                server.login(
                    SMTP_USERNAME,
                    SMTP_PASSWORD
                )

                server.send_message(message)

        else:

            # STARTTLS connection (normally port 587)
            context = ssl.create_default_context()

            with smtplib.SMTP(
                SMTP_HOST,
                SMTP_PORT,
                timeout=10
            ) as server:

                server.starttls(
                    context=context
                )

                server.login(
                    SMTP_USERNAME,
                    SMTP_PASSWORD
                )

                server.send_message(message)

        print(f"Email sent successfully to {to_email}")
        return True

    except Exception as exc:

        # Email failure must not break registration.
        print(f"Email sending failed: {exc}")
        return False


def send_customer_registration_email(
    name: str,
    email: str
) -> bool:

    subject = "Welcome to SupportNova"

    body = f"""Hello {name},

Welcome to SupportNova.

Your Customer account has been successfully created.

You can now log in and submit complaints, track their progress,
and receive updates about your requests.

Thank you for using SupportNova.

SupportNova Team
"""

    return send_email(
        to_email=email,
        subject=subject,
        body=body
    )

def send_customer_complaint_received_email(
    name: str,
    email: str,
    complaint_id: str,
    complaint_title: str
) -> bool:

    subject = f"Complaint Received - {complaint_id}"

    body = f"""Hello {name},

Your complaint has been successfully received by SupportNova.

Complaint ID: {complaint_id}
Subject: {complaint_title}

Our system will process your complaint and you can track its progress
through your SupportNova account.

Thank you for contacting SupportNova.

SupportNova Team
"""

    return send_email(
        to_email=email,
        subject=subject,
        body=body
    )

def send_customer_status_update_email(
    name: str,
    email: str,
    complaint_id: str,
    complaint_title: str,
    status: str
) -> bool:

    subject = f"Complaint Update - {complaint_id}"

    body = f"""Hello {name},

There has been an update to your SupportNova complaint.

Complaint ID: {complaint_id}
Subject: {complaint_title}
Current Status: {status}

Please log in to your SupportNova account to view the latest details.

SupportNova Team
"""

    return send_email(
        to_email=email,
        subject=subject,
        body=body
    )

def send_password_reset_email(
    name: str,
    email: str,
    reset_url: str
) -> bool:

    subject = "Reset your SupportNova password"

    body = f"""Hello {name},

A password reset was requested for your SupportNova account.

Use the link below to choose a new password:

{reset_url}

This link expires in 30 minutes and can only be used once.

If you did not request this, you can safely ignore this email.

SupportNova Team
"""

    return send_email(
        to_email=email,
        subject=subject,
        body=body
    )