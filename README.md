# AI Study Helper

A browser-based AI study helper that generates notes, flashcards, and quizzes from YouTube videos and PDFs.

## Prerequisites

- Node.js (v18+)
- Python (v3.8+)

## Setup

### Backend

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  Set up environment variables:
    - Copy `.env.example` to `.env`:
      ```bash
      cp .env.example .env
      ```
    - Open `.env` and add your `OPENROUTER_API_KEY`.

5.  Run the server:
    ```bash
    uvicorn main:app --reload
    ```
    The backend will be available at `http://localhost:8000`.

### Frontend

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:5173`.

## Usage

1.  Open the frontend in your browser.
2.  Paste a YouTube URL or upload a PDF.
3.  Click "Generate Study Materials".
4.  View and download your notes, flashcards, and quiz.
