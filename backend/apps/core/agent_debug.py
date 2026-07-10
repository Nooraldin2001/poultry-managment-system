"""Session debug logging (agent instrumentation — remove after verification)."""

from __future__ import annotations

import json
import time
import traceback
from pathlib import Path

_SESSION = "cd5244"
_LOG = Path(__file__).resolve().parents[3] / "debug-cd5244.log"


def agent_dbg(location: str, message: str, data: dict | None = None, hypothesis_id: str = "") -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": _SESSION,
            "location": location,
            "message": message,
            "data": data or {},
            "hypothesisId": hypothesis_id,
            "timestamp": int(time.time() * 1000),
        }
        with _LOG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, default=str) + "\n")
    except OSError:
        pass
    # #endregion


def agent_dbg_exception(location: str, exc: BaseException, data: dict | None = None, hypothesis_id: str = "") -> None:
    # #region agent log
    merged = dict(data or {})
    merged["exc_type"] = type(exc).__name__
    merged["exc_msg"] = str(exc)[:500]
    merged["traceback"] = traceback.format_exc()[-1500:]
    agent_dbg(location, "exception", merged, hypothesis_id)
    # #endregion
