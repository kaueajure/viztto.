"""TTL cache and atomic JSON writes. Keys never include credentials."""
import hashlib
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".ratings-")
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(value, handle, ensure_ascii=False, allow_nan=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class Cache:
    def __init__(self, root: Path, ttl: float = 86400):
        self.root, self.ttl = root, ttl

    def path(self, category: str, key: str) -> Path:
        return self.root / category / (hashlib.sha256(key.encode()).hexdigest() + ".json")

    def get(self, category: str, key: str) -> tuple[bool, Any]:
        try:
            data = json.loads(self.path(category, key).read_text())
            if 0 <= time.time() - data["at"] <= self.ttl:
                return True, data["value"]
        except (OSError, ValueError, KeyError, TypeError):
            pass
        return False, None

    def put(self, category: str, key: str, value: Any) -> None:
        write_json(self.path(category, key), {"at": time.time(), "value": value})
