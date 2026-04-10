#!/bin/bash

# AgriGuard Setup Script
echo "🌾 Setting up AgriGuard - AI-Powered Agricultural Insurance Platform"
echo "=================================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your Nokia Network-as-Code API credentials"
else
    echo "✅ .env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✅ Created logs directory"

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected - you can use 'npm run docker:build' and 'npm run docker:run'"
else
    echo "ℹ️  Docker not found - install Docker for containerized deployment"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Edit .env file with your Nokia API credentials:"
echo "   nano .env"
echo ""
echo "2. Start the server:"
echo "   npm start"
echo ""
echo "3. Run the demo (in another terminal):"
echo "   npm run demo"
echo ""
echo "4. Visit the API:"
echo "   http://localhost:3000"
echo ""
echo "📚 Documentation:"
echo "   - API Docs: docs/API_DOCUMENTATION.md"
echo "   - Deployment: docs/DEPLOYMENT.md"
echo "   - Hackathon Submission: docs/HACKATHON_SUBMISSION.md"
echo ""
echo "🌟 Don't forget to star the repository if you find it helpful!"
echo "🤝 Contributions welcome - see CONTRIBUTING.md"