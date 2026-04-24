#!/bin/bash
set -e

echo "Starting deployment..."
git pull

echo "Installing root dependencies..."
npm install

echo "Building client..."
cd client
npm install
npm run build

echo "Installing server dependencies..."
cd ../server
npm install

echo "Restarting app with PM2..."
pm2 restart gradpath

echo "Deployment complete."
