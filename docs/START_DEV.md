# Starting the app locally (scripts)

✅ This document explains how to run the app (backend + frontend) using the provided PowerShell helper script.

## Files added
- `scripts/start-dev.ps1` — PowerShell script that:
  - Detects and kills processes using the configured backend and frontend ports (default 8081 and 3000).
  - Installs backend Python dependencies into `backend/.venv` (if missing).
  - Installs frontend npm dependencies (if missing).
  - Starts the backend (via `uvicorn`) and frontend (via `npm start`) in separate PowerShell windows.

---

## Quick start (recommended)

Open a PowerShell session in the repository root and run:

```powershell
# Use defaults (backend: 8081, frontend: 3000)
.
Scripts\start-dev.ps1
```

This will:
- Kill any processes using ports 8081 and 3000 (unless you pass `-NoKill`).
- Install dependencies (unless you pass `-NoInstall`).
- Open two PowerShell windows and start backend and frontend.

---

## Options
- `-BackendPort <int>` — Start backend on a different port (default 8081)
- `-FrontendPort <int>` — Start frontend on a different port (default 3000)
- `-NoInstall` — Skip installing missing dependencies
- `-NoKill` — Don't kill processes already using the ports
- `-StopOnly` — Kill processes using the configured ports then exit (useful to free ports before manual start)

Examples:

```powershell
# Start services with custom ports
.
Scripts\start-dev.ps1 -BackendPort 8085 -FrontendPort 4000

# Only kill processes using the default ports
.
Scripts\start-dev.ps1 -StopOnly

# Start but skip package installation
.
Scripts\start-dev.ps1 -NoInstall
```

---

## Notes & troubleshooting
- The script expects `python` to be available in PATH for creating the backend venv. If the project already has `.venv` in `backend`, that venv's Python will be used for `pip install`.
- Frontend installs use `npm install --legacy-peer-deps` to avoid peer dependency conflicts seen during development.
- The script launches each service in a separate PowerShell window so you can view logs and stop them independently.
- If your environment uses different Node/python locations, set those paths or run the script from a shell that has the correct tools in PATH.

---

If you'd like, I can:
- Add a `.bat` wrapper for older Windows shells, or
- Add a `stop-dev.ps1` that only kills PIDs found on the configured ports, or
- Add `npm` / Python pre-flight checks to verify versions and produce friendly errors.

Tell me which you'd like next. ✅