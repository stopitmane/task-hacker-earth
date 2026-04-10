# AgriGuard Deployment Guide

## Quick Deploy Options

### 1. Heroku (Recommended for Demo)
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create agriguard-demo

# Set environment variables
heroku config:set NOKIA_API_KEY=your_key
heroku config:set NOKIA_CLIENT_ID=your_id
heroku config:set NOKIA_CLIENT_SECRET=your_secret

# Deploy
git push heroku main
```

### 2. Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 3. Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### 4. Docker
```bash
# Build image
docker build -t agriguard .

# Run container
docker run -p 3000:3000 -e NOKIA_API_KEY=your_key agriguard
```

## Environment Variables

Required for all deployments:
```bash
NOKIA_NAC_BASE_URL=https://network-as-code.nokia.com
NOKIA_API_KEY=your_api_key
NOKIA_CLIENT_ID=your_client_id
NOKIA_CLIENT_SECRET=your_client_secret
PORT=3000
NODE_ENV=production
```

## Production Considerations

1. **Database**: Add PostgreSQL/MongoDB for production
2. **Caching**: Implement Redis for API response caching
3. **Monitoring**: Add application monitoring (New Relic, DataDog)
4. **Security**: Implement rate limiting and API authentication
5. **Scaling**: Use load balancers for high availability