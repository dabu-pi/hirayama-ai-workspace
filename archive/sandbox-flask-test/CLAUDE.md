# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Minimal Flask web application (Flask 3.1) with a single route serving "Hello Flask!" at `/`.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the dev server (starts on http://localhost:5000 with debug mode)
python app.py
```

## Architecture

- **app.py** — Single-file Flask app; all routes defined here.
- **requirements.txt** — Pinned dependencies (UTF-16 encoded).
- **venv/** — Local virtual environment (not committed).
