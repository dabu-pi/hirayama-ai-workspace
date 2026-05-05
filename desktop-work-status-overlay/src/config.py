from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
STATE_FILE = DATA_DIR / "state.json"

STATUS_OPTIONS = [
    "待機",
    "設計中",
    "指示作成中",
    "実装中",
    "LiveCheck中",
    "テスト中",
    "commit中",
    "push中",
    "deploy中",
    "完了",
    "要確認",
    "エラー",
]

COLORS = {
    "bg": "#1E1E2E",
    "header_bg": "#181825",
    "active_desk": "#313244",
    "inactive_desk": "#1E1E2E",
    "separator": "#45475A",
    "text": "#CDD6F4",
    "text_dim": "#585B70",
    "text_label": "#89DCEB",
    "gpt_color": "#89B4FA",
    "claude_color": "#FAB387",
    "memo_color": "#A6ADC8",
    "active_dot": "#A6E3A1",
    "status_err": "#F38BA8",
    "status_warn": "#F9E2AF",
    "status_ok": "#A6E3A1",
    "header_text": "#CDD6F4",
    "close_hover": "#F38BA8",
    "btn_active": "#89B4FA",
    "btn_inactive": "#45475A",
    "entry_bg": "#2A2A3E",
    "border": "#45475A",
}

DEFAULT_STATE = {
    "activeDesktop": 1,
    "window": {
        "x": 1560,
        "y": 40,
        "opacity": 0.92,
    },
    "desktops": {
        "1": {
            "projectName": "Desktop 1",
            "gptStatus": "待機",
            "claudeStatus": "待機",
            "memo": "",
            "updatedAt": "",
        },
        "2": {
            "projectName": "Desktop 2",
            "gptStatus": "待機",
            "claudeStatus": "待機",
            "memo": "",
            "updatedAt": "",
        },
        "3": {
            "projectName": "Desktop 3",
            "gptStatus": "待機",
            "claudeStatus": "待機",
            "memo": "",
            "updatedAt": "",
        },
    },
}
