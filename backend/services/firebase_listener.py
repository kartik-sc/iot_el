"""
Subscribes to Firebase /telemetry/latest via Admin SDK.
Persists every change to telemetry_snapshots and manages fault_events.
"""
import json
import logging
import os
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, db as rtdb

from ..config import settings

logger = logging.getLogger(__name__)

_app: firebase_admin.App | None = None


def init_firebase() -> None:
    global _app
    if _app:
        return

    if settings.firebase_service_account_json:
        cred_dict = json.loads(settings.firebase_service_account_json)
        cred = credentials.Certificate(cred_dict)
    else:
        cred = credentials.Certificate(settings.firebase_service_account_path)

    _app = firebase_admin.initialize_app(cred, {
        "databaseURL": _resolve_db_url(cred)
    })
    logger.info("Firebase Admin SDK initialised")


def _resolve_db_url(cred: credentials.Certificate) -> str:
    # Extract project_id from the service account and build the default RTDB URL
    project_id = cred.project_id
    return f"https://{project_id}-default-rtdb.firebaseio.com"


def write_command_to_firebase(crane_namespace: str, cmd: dict) -> None:
    path = f"/{crane_namespace}/commands/latest" if crane_namespace else "/commands/latest"
    rtdb.reference(path).set(cmd)


def write_estop_to_firebase(crane_namespace: str) -> None:
    path = f"/{crane_namespace}/commands/estop" if crane_namespace else "/commands/estop"
    rtdb.reference(path).set({"emergency": True, "timestamp": datetime.now(timezone.utc).isoformat()})


def start_telemetry_listener(crane_namespace: str, on_telemetry) -> None:
    """
    Registers a Firebase listener for /telemetry/latest.
    on_telemetry(data: dict) is called every time the value changes.
    This is a blocking listener — run in a background thread.
    """
    path = f"/{crane_namespace}/telemetry/latest" if crane_namespace else "/telemetry/latest"

    def _handler(event):
        if event.data:
            on_telemetry(event.data)

    rtdb.reference(path).listen(_handler)
    logger.info("Firebase telemetry listener started on %s", path)
