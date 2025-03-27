# Finance Dashboard UI

This is a React-based frontend for the Finance Dashboard application. It connects to a FastAPI backend that interfaces with your SQLite database.

## Setup

### Frontend Setup

1. Install JavaScript dependencies:
   ```
   npm install
   ```

### Backend Setup

1. Install Python dependencies:
   ```
   cd api
   pip install -r requirements.txt
   ```

2. Run the application (both frontend and API):
   ```
   npm run dev:all
   ```
   This will start both the React frontend on port 3000 and the FastAPI server on port 3001.

3. For development only:
   - Frontend only: `npm run dev`
   - API server only: `npm run api`

4. Build for production:
   ```
   npm run build
   ```

## Architecture

- **Frontend**: React with Vite for modern development experience
- **Backend**: FastAPI Python server to expose SQLite data
- **Data Visualization**: Chart.js for interactive charts

## Features

- View most recent transaction
- Analyze recurring transactions
- Visualize monthly spending by category
- See top merchants by transaction count
- Interactive charts and responsive tables

## Connection to Database

The FastAPI server connects to your existing SQLite database located at `../../data/finance-prod.db`. Make sure the database path in `api/main.py` is correct.

## API Documentation

When the FastAPI server is running, you can access the auto-generated API documentation at:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc 