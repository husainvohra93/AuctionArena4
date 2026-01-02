# Auction Arena

A real-time cricket auction management system built with React and Node.js.

## 🚀 Features

*   **Real-time Auction Control**: Live bidding, player selection, and team budget management.
*   **User Management**: Role-based access (Admin, Team Owner).
*   **Team & Player Management**: Import/Export via Excel, budget tracking, and squad stats.
*   **Data Visualization**: Dashboard with key statistics and beautiful UI.
*   **Export Reports**: Download team squads and auction results in Excel and PDF formats.

## 🛠️ Tech Stack

*   **Frontend**: React, Tailwind CSS, Radix UI, Axios.
*   **Backend**: Node.js, Express, MongoDB (Mongoose).
*   **Tools**: ExcelJS (Excel import/export), PDFKit (PDF generation), Multer (Image upload).

## 📋 Prerequisites

Before running the application, ensure you have the following installed:

1.  **Node.js** (v18 or higher)
2.  **MongoDB** (Local instance or Atlas connection string)

## ⚙️ Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd AuctionArena4
    ```

2.  **Install Backend Dependencies:**
    ```bash
    cd backend-express
    npm install
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    cd ../frontend
    npm install --legacy-peer-deps
    ```

4.  **Environment Setup:**
    *   **Backend**: Create `backend-express/.env`.
        ```env
        PORT=8000
        MONGO_URL=mongodb://localhost:27017/auction_arena
        SESSION_SECRET=your_secret_key
        CORS_ORIGINS=http://localhost:3000
        SESSION_COOKIE_SECURE=false
        ```
    *   **Frontend**: Create `frontend/.env` (if not exists).
        ```env
        REACT_APP_BACKEND_URL=http://localhost:8000
        ```

## ▶️ Running the App

### The Easy Way (Windows)

We have provided a text-to-run script that handles everything for you.

1.  Navigate to the project root folder.
2.  Double-click **`start-app.bat`**.

This will:
*   Launch the **Backend** server in a new window.
*   Wait 5 seconds for it to initialize.
*   Launch the **Frontend** server in a new window.
*   The app should automatically open or be available at `http://localhost:3000`.

### Manual Start

If you prefer running commands manually:

1.  **Start Backend:**
    ```bash
    cd backend-express
    npm run dev
    ```
    *Server runs on port 8000.*

2.  **Start Frontend:**
    ```bash
    cd frontend
    npm start
    ```
    *App runs on port 3000.*

## 📁 Project Structure

*   `frontend/`: React application source code.
*   `backend-express/`: Node.js Express API server.
*   `start-app.bat`: Windows batch script for one-click startup.

## 🔑 Default Credentials

*   **Admin**: Create the first user via the `/register` page (or access `/login` if you have an account). The first registered user usually defaults to `team_owner`, but you can update the role directly in the database or via a setup script if configured.
*   **Note**: Passwords are securely hashed.
