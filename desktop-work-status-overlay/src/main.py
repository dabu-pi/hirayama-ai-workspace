"""
Work Status Overlay — Phase 1 entry point
"""
import sys
import traceback
from pathlib import Path

# src/ を sys.path に追加して config 等を import 可能にする
sys.path.insert(0, str(Path(__file__).parent))

import tkinter as tk

from config import STATE_FILE
from overlay_window import OverlayWindow
from state_store import StateStore


def main():
    store = StateStore(STATE_FILE)

    root = tk.Tk()
    root.title("Work Status Overlay")

    OverlayWindow(root, store)
    root.mainloop()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        input("エラーが発生しました。Enter で終了...")
