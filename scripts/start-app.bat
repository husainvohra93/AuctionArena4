@echo off
echo Starting Auction Arena App...

:: Navigate to project root (parent of 'scripts')
cd ..

:: Start Backend
echo Starting Backend (Express)...
start "Auction Arena Backend" cmd /k "cd backend-express && npm run dev"

:: Wait for Backend to initialize (5 seconds)
echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: Start Frontend
echo Starting Frontend (React)...
start "Auction Arena Frontend" cmd /k "cd frontend && npm start"

echo.
echo App launched!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
pause
