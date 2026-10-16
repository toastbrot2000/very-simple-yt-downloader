"""task_dir() is the only gate between a task id and rmtree."""

import os
import uuid

import pytest

from app import downloads


def test_valid_id_stays_inside_download_dir():
    tid = str(uuid.uuid4())
    path = downloads.task_dir(tid)
    assert path == os.path.join(os.path.realpath(downloads.DOWNLOAD_DIR), tid)


@pytest.mark.parametrize("bad", ["..", "../etc", "/etc", "", "not-a-uuid"])
def test_non_uuid_ids_are_rejected(bad):
    with pytest.raises(ValueError):
        downloads.task_dir(bad)


def test_cleanup_ignores_invalid_id():
    downloads.cleanup_task("../../")  # must log and return, never rmtree
