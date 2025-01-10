#!/bin/bash

# Kill any processes running on ports 3000 and 3001
echo "Cleaning up ports..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Start backend
echo "Starting backend..."
cd chatgenius-be
npm install
npm run start:dev &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 5

# Start frontend
echo "Starting frontend..."
cd ../chatgenius-fe
npm install
npm run dev &
FRONTEND_PID=$!

# Handle script termination
trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT SIGTERM EXIT

# Keep script running
wait 