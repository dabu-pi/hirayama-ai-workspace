import tkinter as tk
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

from config import COLORS, STATUS_OPTIONS
from state_store import StateStore

JST = timezone(timedelta(hours=9))

FONT_HEADER = ("Meiryo UI", 9, "bold")
FONT_PROJ = ("Meiryo UI", 8, "bold")
FONT_STATUS = ("Meiryo UI", 8)
FONT_MEMO = ("Meiryo UI", 7)
FONT_CLOCK = ("Meiryo UI", 7)


def _status_color(status: str, kind: str) -> str:
    if status == "エラー":
        return COLORS["status_err"]
    if status == "要確認":
        return COLORS["status_warn"]
    if status == "完了":
        return COLORS["status_ok"]
    if status == "待機":
        return COLORS["text_dim"]
    if kind == "gpt":
        return COLORS["gpt_color"]
    return COLORS["claude_color"]


class OverlayWindow:
    def __init__(self, root: tk.Tk, store: StateStore):
        self.root = root
        self.store = store
        self.state: Dict[str, Any] = store.load()
        self._drag_ox = 0
        self._drag_oy = 0
        self._minimized = False
        self._desk_widgets: Dict[int, Dict[str, Any]] = {}

        self._setup_window()
        self._build_ui()
        self._refresh()
        self._tick_clock()
        self._autosave()

    # ------------------------------------------------------------------ window setup

    def _setup_window(self):
        self.root.overrideredirect(True)
        self.root.wm_attributes("-topmost", True)
        opacity = self.state.get("window", {}).get("opacity", 0.92)
        self.root.wm_attributes("-alpha", opacity)
        self.root.configure(bg=COLORS["bg"])

        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = self.state.get("window", {}).get("x", sw - 340)
        y = self.state.get("window", {}).get("y", 40)
        x = max(0, min(x, sw - 100))
        y = max(0, min(y, sh - 100))
        self.root.geometry(f"+{x}+{y}")

    # ------------------------------------------------------------------ UI build

    def _build_ui(self):
        self._build_header()
        self.body = tk.Frame(self.root, bg=COLORS["bg"])
        self.body.pack(fill=tk.BOTH, expand=True)
        for i in (1, 2, 3):
            self._build_desk_block(i)
        self._build_footer()
        self.root.bind("<Button-3>", self._ctx_menu)

    def _build_header(self):
        hdr = tk.Frame(self.root, bg=COLORS["header_bg"], height=22)
        hdr.pack(fill=tk.X)
        hdr.pack_propagate(False)

        title = tk.Label(
            hdr, text="● Work Status",
            bg=COLORS["header_bg"], fg=COLORS["header_text"],
            font=FONT_HEADER,
        )
        title.pack(side=tk.LEFT, padx=8)

        close = tk.Label(
            hdr, text="×",
            bg=COLORS["header_bg"], fg=COLORS["text_dim"],
            font=("Meiryo UI", 12, "bold"), cursor="hand2", padx=6,
        )
        close.pack(side=tk.RIGHT)
        close.bind("<Button-1>", self._on_close)
        close.bind("<Enter>", lambda e: close.config(fg=COLORS["close_hover"]))
        close.bind("<Leave>", lambda e: close.config(fg=COLORS["text_dim"]))

        mini = tk.Label(
            hdr, text="−",
            bg=COLORS["header_bg"], fg=COLORS["text_dim"],
            font=("Meiryo UI", 12, "bold"), cursor="hand2", padx=4,
        )
        mini.pack(side=tk.RIGHT)
        mini.bind("<Button-1>", self._toggle_minimize)
        mini.bind("<Enter>", lambda e: mini.config(fg=COLORS["text"]))
        mini.bind("<Leave>", lambda e: mini.config(fg=COLORS["text_dim"]))

        for w in (hdr, title):
            w.bind("<ButtonPress-1>", self._drag_start)
            w.bind("<B1-Motion>", self._drag_move)

    def _build_desk_block(self, num: int):
        outer = tk.Frame(self.body, bg=COLORS["inactive_desk"], bd=0)
        outer.pack(fill=tk.X, padx=4, pady=(2, 0))

        # Top row: D-button + project name
        top = tk.Frame(outer, bg=COLORS["inactive_desk"])
        top.pack(fill=tk.X, padx=5, pady=(5, 1))

        dbtn = tk.Label(
            top, text=f"D{num}",
            bg=COLORS["btn_inactive"], fg=COLORS["text"],
            font=("Meiryo UI", 7, "bold"),
            width=2, padx=3, pady=1, cursor="hand2",
        )
        dbtn.pack(side=tk.LEFT, padx=(0, 5))
        dbtn.bind("<Button-1>", lambda e, d=num: self._set_active(d))

        proj = tk.Label(top, text="", bg=COLORS["inactive_desk"], fg=COLORS["text_dim"],
                        font=FONT_PROJ, anchor="w")
        proj.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Middle row: GPT + Claude status
        mid = tk.Frame(outer, bg=COLORS["inactive_desk"])
        mid.pack(fill=tk.X, padx=5, pady=0)

        gpt_lbl = tk.Label(mid, text="GPT:", bg=COLORS["inactive_desk"],
                           fg=COLORS["text_dim"], font=FONT_STATUS)
        gpt_lbl.pack(side=tk.LEFT)
        gpt_val = tk.Label(mid, text="待機", bg=COLORS["inactive_desk"],
                           fg=COLORS["text_dim"], font=FONT_STATUS)
        gpt_val.pack(side=tk.LEFT, padx=(0, 10))

        cl_lbl = tk.Label(mid, text="CL:", bg=COLORS["inactive_desk"],
                          fg=COLORS["text_dim"], font=FONT_STATUS)
        cl_lbl.pack(side=tk.LEFT)
        cl_val = tk.Label(mid, text="待機", bg=COLORS["inactive_desk"],
                          fg=COLORS["text_dim"], font=FONT_STATUS)
        cl_val.pack(side=tk.LEFT)

        # Bottom row: memo
        bot = tk.Frame(outer, bg=COLORS["inactive_desk"])
        bot.pack(fill=tk.X, padx=5, pady=(0, 5))

        memo = tk.Label(bot, text="", bg=COLORS["inactive_desk"],
                        fg=COLORS["memo_color"], font=FONT_MEMO,
                        anchor="w", wraplength=260, justify="left")
        memo.pack(fill=tk.X)

        # Double-click to edit on any sub-widget
        for w in (outer, top, mid, bot, proj, gpt_val, cl_val, memo):
            w.bind("<Double-Button-1>", lambda e, d=num: self._edit_dialog(d))

        sep = tk.Frame(self.body, bg=COLORS["separator"], height=1)
        sep.pack(fill=tk.X, padx=4)

        self._desk_widgets[num] = {
            "outer": outer, "top": top, "mid": mid, "bot": bot, "sep": sep,
            "dbtn": dbtn, "proj": proj,
            "gpt_lbl": gpt_lbl, "gpt_val": gpt_val,
            "cl_lbl": cl_lbl, "cl_val": cl_val,
            "memo": memo,
        }

    def _build_footer(self):
        self._clock_lbl = tk.Label(
            self.root, text="",
            bg=COLORS["bg"], fg=COLORS["text_dim"], font=FONT_CLOCK,
        )
        self._clock_lbl.pack(side=tk.LEFT, padx=8, pady=(2, 4))

        hint = tk.Label(
            self.root, text="右クリック: メニュー  ダブルクリック: 編集",
            bg=COLORS["bg"], fg=COLORS["text_dim"], font=FONT_CLOCK,
        )
        hint.pack(side=tk.RIGHT, padx=8, pady=(2, 4))

    # ------------------------------------------------------------------ refresh

    def _refresh(self):
        active = self.state.get("activeDesktop", 1)
        desktops = self.state.get("desktops", {})

        for i in (1, 2, 3):
            d = desktops.get(str(i), {})
            w = self._desk_widgets[i]
            is_active = (i == active)

            bg = COLORS["active_desk"] if is_active else COLORS["inactive_desk"]

            for key in ("outer", "top", "mid", "bot"):
                w[key].config(bg=bg)
            for key in ("proj", "gpt_lbl", "gpt_val", "cl_lbl", "cl_val", "memo"):
                w[key].config(bg=bg)

            proj_name = d.get("projectName", f"Desktop {i}")
            w["proj"].config(
                text=proj_name,
                fg=COLORS["text"] if is_active else COLORS["text_dim"],
            )

            gpt_s = d.get("gptStatus", "待機")
            cl_s = d.get("claudeStatus", "待機")
            w["gpt_val"].config(text=gpt_s, fg=_status_color(gpt_s, "gpt"))
            w["cl_val"].config(text=cl_s, fg=_status_color(cl_s, "cl"))

            memo_txt = d.get("memo", "")
            if memo_txt:
                short = memo_txt[:45] + ("…" if len(memo_txt) > 45 else "")
                w["memo"].config(text=f"→ {short}")
            else:
                w["memo"].config(text="")

            if is_active:
                w["dbtn"].config(bg=COLORS["btn_active"], fg="#1E1E2E")
            else:
                w["dbtn"].config(bg=COLORS["btn_inactive"], fg=COLORS["text"])

    def _tick_clock(self):
        now = datetime.now(JST).strftime("%H:%M")
        self._clock_lbl.config(text=now)
        self.root.after(60_000, self._tick_clock)

    def _autosave(self):
        self._save_pos()
        self.store.save(self.state)
        self.root.after(30_000, self._autosave)

    # ------------------------------------------------------------------ drag

    def _drag_start(self, event):
        self._drag_ox = event.x_root - self.root.winfo_x()
        self._drag_oy = event.y_root - self.root.winfo_y()

    def _drag_move(self, event):
        x = event.x_root - self._drag_ox
        y = event.y_root - self._drag_oy
        self.root.geometry(f"+{x}+{y}")
        self.state.setdefault("window", {})["x"] = x
        self.state.setdefault("window", {})["y"] = y

    # ------------------------------------------------------------------ actions

    def _set_active(self, num: int):
        self.state["activeDesktop"] = num
        self.store.save(self.state)
        self._refresh()

    def _set_field(self, desk: int, field: str, value: str):
        self.state.setdefault("desktops", {}).setdefault(str(desk), {})
        self.state["desktops"][str(desk)][field] = value
        self.state["desktops"][str(desk)]["updatedAt"] = StateStore.now_jst()
        self.store.save(self.state)
        self._refresh()

    def _toggle_minimize(self, event=None):
        if self._minimized:
            self.body.pack(fill=tk.BOTH, expand=True)
            self._minimized = False
        else:
            self.body.pack_forget()
            self._minimized = True

    def _on_close(self, event=None):
        self._save_pos()
        self.store.save(self.state)
        self.root.destroy()

    def _save_pos(self):
        self.state.setdefault("window", {})
        self.state["window"]["x"] = self.root.winfo_x()
        self.state["window"]["y"] = self.root.winfo_y()

    # ------------------------------------------------------------------ context menu

    def _ctx_menu(self, event):
        active = self.state.get("activeDesktop", 1)
        m = tk.Menu(self.root, tearoff=0,
                    bg=COLORS["active_desk"], fg=COLORS["text"],
                    activebackground=COLORS["header_bg"],
                    activeforeground=COLORS["text"])

        # Active desktop switch
        dsub = tk.Menu(m, tearoff=0, bg=COLORS["active_desk"], fg=COLORS["text"],
                       activebackground=COLORS["header_bg"])
        for i in (1, 2, 3):
            mark = "● " if i == active else "  "
            dsub.add_command(label=f"{mark}Desktop {i}",
                             command=lambda d=i: self._set_active(d))
        m.add_cascade(label="アクティブ Desktop", menu=dsub)
        m.add_separator()

        m.add_command(label=f"D{active} を編集…",
                      command=lambda: self._edit_dialog(active))
        m.add_separator()

        # GPT status submenu
        gsub = tk.Menu(m, tearoff=0, bg=COLORS["active_desk"], fg=COLORS["text"],
                       activebackground=COLORS["header_bg"])
        for s in STATUS_OPTIONS:
            gsub.add_command(label=s,
                             command=lambda st=s: self._set_field(active, "gptStatus", st))
        m.add_cascade(label=f"GPT 状態 (D{active})", menu=gsub)

        # Claude status submenu
        csub = tk.Menu(m, tearoff=0, bg=COLORS["active_desk"], fg=COLORS["text"],
                       activebackground=COLORS["header_bg"])
        for s in STATUS_OPTIONS:
            csub.add_command(label=s,
                             command=lambda st=s: self._set_field(active, "claudeStatus", st))
        m.add_cascade(label=f"Claude 状態 (D{active})", menu=csub)
        m.add_separator()

        m.add_command(label="終了", command=self._on_close)

        try:
            m.tk_popup(event.x_root, event.y_root)
        finally:
            m.grab_release()

    # ------------------------------------------------------------------ edit dialog

    def _edit_dialog(self, desk: int):
        d = self.state.get("desktops", {}).get(str(desk), {})

        dlg = tk.Toplevel(self.root)
        dlg.title(f"Desktop {desk} を編集")
        dlg.configure(bg=COLORS["bg"])
        dlg.wm_attributes("-topmost", True)
        dlg.resizable(False, False)
        dlg.grab_set()

        ox = self.root.winfo_x()
        oy = self.root.winfo_y()
        dlg.geometry(f"+{ox}+{oy + 30}")

        tk.Label(dlg, text=f"── Desktop {desk} ──",
                 bg=COLORS["bg"], fg=COLORS["text_label"],
                 font=("Meiryo UI", 9, "bold")).grid(
            row=0, column=0, columnspan=2, pady=(10, 6))

        fields: Dict[str, Any] = {}
        spec = [
            ("プロジェクト名", "projectName", "entry"),
            ("GPT 状態", "gptStatus", "combo"),
            ("Claude 状態", "claudeStatus", "combo"),
            ("メモ / 次アクション", "memo", "entry"),
        ]

        for row, (label, key, kind) in enumerate(spec, start=1):
            tk.Label(dlg, text=label + ":", bg=COLORS["bg"], fg=COLORS["text"],
                     font=("Meiryo UI", 8), anchor="e", width=16).grid(
                row=row, column=0, padx=(12, 4), pady=4, sticky="e")

            current = d.get(key, "")

            if kind == "combo":
                var = tk.StringVar(value=current or "待機")
                opt = tk.OptionMenu(dlg, var, *STATUS_OPTIONS)
                opt.config(bg=COLORS["entry_bg"], fg=COLORS["text"],
                           activebackground=COLORS["active_desk"],
                           highlightthickness=0, font=("Meiryo UI", 8),
                           width=14, relief=tk.FLAT)
                opt["menu"].config(bg=COLORS["entry_bg"], fg=COLORS["text"],
                                   activebackground=COLORS["active_desk"])
                opt.grid(row=row, column=1, padx=(0, 12), pady=4, sticky="w")
                fields[key] = var
            else:
                ent = tk.Entry(dlg, bg=COLORS["entry_bg"], fg=COLORS["text"],
                               insertbackground="white", font=("Meiryo UI", 8),
                               width=26, relief=tk.FLAT)
                ent.insert(0, current)
                ent.grid(row=row, column=1, padx=(0, 12), pady=4, sticky="ew")
                if row == 1:
                    ent.focus_set()
                fields[key] = ent

        # Buttons
        bf = tk.Frame(dlg, bg=COLORS["bg"])
        bf.grid(row=len(spec) + 1, column=0, columnspan=2, pady=12)

        def do_save():
            self.state.setdefault("desktops", {}).setdefault(str(desk), {})
            for key, widget in fields.items():
                val = widget.get() if isinstance(widget, tk.StringVar) else widget.get()
                self.state["desktops"][str(desk)][key] = val
            self.state["desktops"][str(desk)]["updatedAt"] = StateStore.now_jst()
            self.store.save(self.state)
            self._refresh()
            dlg.destroy()

        tk.Button(bf, text="保存 (Enter)", command=do_save,
                  bg=COLORS["btn_active"], fg="#1E1E2E",
                  font=("Meiryo UI", 8, "bold"), relief=tk.FLAT,
                  padx=16, cursor="hand2").pack(side=tk.LEFT, padx=4)

        tk.Button(bf, text="キャンセル", command=dlg.destroy,
                  bg=COLORS["active_desk"], fg=COLORS["text"],
                  font=("Meiryo UI", 8), relief=tk.FLAT,
                  padx=10, cursor="hand2").pack(side=tk.LEFT, padx=4)

        dlg.bind("<Return>", lambda e: do_save())
        dlg.bind("<Escape>", lambda e: dlg.destroy())
