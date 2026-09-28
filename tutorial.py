"""Create the editable tutorial once, without modifying any existing canvas."""
import json
import time
import uuid
from pathlib import Path
from threading import Lock

_tutorial_lock = Lock()
TEMPLATE_VERSION = "kitten-v1"


def ensure_tutorial_canvas(canvas_dir, template_path, save_canvas):
    # A separate lock serializes tutorial creation; save_canvas owns CANVAS_LOCK.
    with _tutorial_lock:
        for path in Path(canvas_dir).glob("*.json"):
            try:
                existing = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if (isinstance(existing, dict)
                    and existing.get("tutorial_template") == TEMPLATE_VERSION
                    and not existing.get("deleted_at")):
                return existing

        canvas = json.loads(Path(template_path).read_text(encoding="utf-8"))
        timestamp = int(time.time() * 1000)
        canvas.update(
            id=uuid.uuid4().hex,
            tutorial_template=TEMPLATE_VERSION,
            created_at=timestamp,
            updated_at=timestamp,
        )
        save_canvas(canvas)
        return canvas
