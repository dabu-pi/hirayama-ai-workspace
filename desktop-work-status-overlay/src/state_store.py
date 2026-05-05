import copy
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict

JST = timezone(timedelta(hours=9))


class StateStore:
    def __init__(self, state_path: Path):
        self.state_path = state_path
        self.state_path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> Dict[str, Any]:
        if not self.state_path.exists():
            return self._default()
        try:
            with open(self.state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._merge_defaults(data)
        except Exception as e:
            print(f"[StateStore] Load error: {e}")
            return self._default()

    def save(self, state: Dict[str, Any]) -> None:
        try:
            with open(self.state_path, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[StateStore] Save error: {e}")

    @staticmethod
    def now_jst() -> str:
        return datetime.now(JST).isoformat(timespec="seconds")

    def _default(self) -> Dict[str, Any]:
        from config import DEFAULT_STATE
        return copy.deepcopy(DEFAULT_STATE)

    def _merge_defaults(self, data: Dict[str, Any]) -> Dict[str, Any]:
        from config import DEFAULT_STATE
        merged = copy.deepcopy(DEFAULT_STATE)
        merged.update(data)
        # Ensure all 3 desktops exist
        merged.setdefault("desktops", {})
        for k in ["1", "2", "3"]:
            if k not in merged["desktops"]:
                merged["desktops"][k] = copy.deepcopy(DEFAULT_STATE["desktops"][k])
        return merged
