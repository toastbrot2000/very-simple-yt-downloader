"""run_download must bail before building a YoutubeDL when a task is cancelled
while still queued, so these run with no network and no yt-dlp call."""

import threading

from app import downloads
from app.downloads import run_download

TASK_ID = "550e8400-e29b-41d4-a716-446655440000"


def test_already_cancelled_task_is_left_untouched():
    downloads.download_progress[TASK_ID] = {"status": "cancelled", "progress": 0}
    run_download(TASK_ID, "https://example.com/watch?v=a", "mp4", "best")
    assert downloads.download_progress[TASK_ID]["status"] == "cancelled"


def test_cancel_event_set_while_queued_finalises_as_cancelled():
    downloads.download_progress[TASK_ID] = {"status": "queued", "progress": 0}
    event = threading.Event()
    event.set()
    downloads.cancel_events[TASK_ID] = event
    run_download(TASK_ID, "https://example.com/watch?v=a", "mp4", "best")
    assert downloads.download_progress[TASK_ID]["status"] == "cancelled"
    assert TASK_ID not in downloads.cancel_events  # event consumed, no stale flag left
