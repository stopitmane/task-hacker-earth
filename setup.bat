@echo off
echo 🌾 Setting up AgriGuard - AI-Powered Agricultural Insurance Platform
echo ==================================================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node --version

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your Nokia Network-as-Code API credentials
) else (
    echo ✅ .env file already exists
)

REM Create logs directory
if not exist logs mkdir logs
echo ✅ Created logs directory

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 🐳 Docker detected - you can use 'npm run docker:build' and 'npm run docker:run'
) else (
    echo ℹ️  Docker not found - install Docker for containerized deployment
)

echo.
echo 🎉 Setup complete! Next steps:
echo.
echo 1. Edit .env file with your Nokia API credentials:
echo    notepad .env
echo.
echo 2. Start the server:
echo    npm start
echo.
echo 3. Run the demo (in another terminal):
echo    npm run demo
echo.
echo 4. Visit the API:
echo    http://localhost:3000
echo.
echo 📚 Documentation:
echo    - API Docs: docs/API_DOCUMENTATION.md
echo    - Deployment: docs/DEPLOYMENT.md
echo    - Hackathon Submission: docs/HACKATHON_SUBMISSION.md
echo.
echo 🌟 Don't forget to star the repository if you find it helpful!
echo 🤝 Contributions welcome - see CONTRIBUTING.md
echo.
pause