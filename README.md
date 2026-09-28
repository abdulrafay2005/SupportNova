# SupportNova

## Generative AI Customer Complaint Resolution Intelligence

SupportNova is a customer complaint processing and resolution intelligence system designed to help organizations process complaints through a structured, controlled, and auditable workflow.

Instead of sending complaint text directly to a Generative AI model, SupportNova combines:

* Complaint validation and preprocessing
* Machine-learning classification
* Deterministic Python rule processing
* Policy and resolution rules
* Department routing
* Escalation rules
* Optional Generative AI processing
* Structured AI output
* Output validation
* JWT authentication and role-based access
* MongoDB data storage
* Complaint history and analysis

---

# 1. Project Structure

The main project is divided into three major parts:

```text
SupportNova/
│
├── api/                    # FastAPI backend
│   ├── main.py
│   └── ...
│
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   ├── package.json
│   └── ...
│
├── ml/                     # Machine-learning and intelligence layer
│   ├── train.py
│   ├── rule_engine.py
│   ├── genai.py
│   ├── validator.py
│   ├── ai_output_guard.py
│   ├── schema_validator.py
│   ├── prompt_manager.py
│   └── ...
│
├── data/                   # Project datasets and rule data
│
├── docs/                   # Project documentation
│   └── DEVELOPER_GUIDE.md
│
├── requirements.txt        # Python dependencies
├── README.md               # Project documentation
└── .env                    # Environment configuration
```

---

# 2. Technologies Used

## Backend

* Python
* FastAPI
* Uvicorn
* Pydantic
* PyMongo
* MongoDB Atlas
* JWT authentication
* Passlib
* Bcrypt

## Machine Learning

* Pandas
* NumPy
* Scikit-learn
* TF-IDF
* Logistic Regression
* Structured CSV datasets
* Python rule engine

## Generative AI

* GenAI API integration
* Optional OpenAI API
* Structured JSON output
* JSON Schema validation
* AI output guarding

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

## Document Processing

* PDF processing
* DOCX processing
* Knowledge-base document handling

---

# 3. Requirements

Before running SupportNova, install the following:

### Required

* Python 3.11 or newer
* Node.js 20 or newer
* npm
* MongoDB Atlas account/database
* Git

### Optional

* OpenAI API key if Generative AI processing is enabled

---

# 4. Clone the Repository

Open a terminal and clone the project:

```bash
git clone <YOUR_REPOSITORY_URL>
```

Move into the project directory:

```bash
cd SupportNova
```

> Replace `<YOUR_REPOSITORY_URL>` with the repository URL.

---

# 5. Backend Setup

## Step 1 — Create a Python Virtual Environment

From the project root:

### Windows

```bash
python -m venv .venv
```

Activate the environment:

```bash
.venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv .venv
```

Activate:

```bash
source .venv/bin/activate
```

After activation, your terminal should indicate that the virtual environment is active.

---

# 6. Install Python Dependencies

With the virtual environment activated:

```bash
pip install -r requirements.txt
```

If `pip` is unavailable, use:

```bash
python -m pip install -r requirements.txt
```

---

# 7. Configure Environment Variables

Create a `.env` file in the **project root**.

Example:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/supportnova

JWT_SECRET_KEY=your-secret-key

CORS_ORIGINS=http://localhost:5173

OPENAI_ENABLED=false

OPENAI_API_KEY=

SUPPORTNOVA_PROMPT_VERSION=1.0
```

## Environment Variables

| Variable                     | Required          | Description                        |
| ---------------------------- | ----------------- | ---------------------------------- |
| `MONGO_URI`                  | Yes               | MongoDB Atlas connection string    |
| `JWT_SECRET_KEY`             | Yes               | Secret used for JWT authentication |
| `CORS_ORIGINS`               | Yes               | Allowed frontend origin            |
| `OPENAI_ENABLED`             | No                | Enables/disables OpenAI processing |
| `OPENAI_API_KEY`             | Only when enabled | OpenAI API key                     |
| `SUPPORTNOVA_PROMPT_VERSION` | No                | Prompt version identifier          |

### Important

Do **not** commit `.env` to GitHub.

Your actual MongoDB credentials, JWT secret, and API keys should remain private.

---

# 8. MongoDB Atlas Setup

SupportNova uses MongoDB Atlas for persistent storage.

Create a MongoDB Atlas cluster and database.

The application uses the `supportnova` database.

The application creates/uses collections for project data such as:

```text
users
complaints
analyses
```

Additional collections may be used by the implemented audit, knowledge-base, and workflow features.

Your MongoDB connection string should be placed in:

```env
MONGO_URI=your_mongodb_connection_string
```

---

# 9. Train the Machine-Learning Models

SupportNova uses trained classification models for parts of its complaint intelligence pipeline.

From the project root, run:

```bash
python ml/train.py
```

This generates the required trained model artifacts.

The training process uses the project's structured datasets for classification.

The trained models are used by the application for tasks such as:

* Category classification
* Subcategory classification
* Department classification

### When should this be run?

Run the training command after installing the Python dependencies and before starting the backend if the trained `.pkl` model files are not already present.

```bash
python ml/train.py
```

After successful training, the generated model files are available for the application.

---

# 10. Start the Backend

From the **project root**, with the virtual environment activated:

```bash
python -m uvicorn api.main:app --reload
```

Alternatively:

```bash
uvicorn api.main:app --reload
```

The backend will normally be available at:

```text
http://localhost:8000
```

---

# 11. Verify the Backend

Open:

```text
http://localhost:8000/
```

The health endpoint is:

```text
http://localhost:8000/api/health
```

FastAPI also provides interactive API documentation.

Open:

```text
http://localhost:8000/docs
```

This provides an interactive Swagger interface for testing the API.

---

# 12. Start the Frontend

Open a **second terminal**.

Move into the frontend directory:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# 13. Run the Complete Project

The easiest development setup is to use **two terminals**.

## Terminal 1 — Backend

From the project root:

```bash
.venv\Scripts\activate
python -m uvicorn api.main:app --reload
```

## Terminal 2 — Frontend

From the project root:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

The frontend communicates with the FastAPI backend through the configured API base/proxy.

---

# 14. Recommended Startup Order

For a fresh setup, use this order:

```text
1. Clone repository
        ↓
2. Create Python virtual environment
        ↓
3. Install Python dependencies
        ↓
4. Configure .env
        ↓
5. Configure MongoDB Atlas
        ↓
6. Train ML models
        ↓
7. Start FastAPI backend
        ↓
8. Install frontend dependencies
        ↓
9. Start React/Vite frontend
        ↓
10. Open the application
```

---

# 15. Authentication

SupportNova uses JWT-based authentication.

The authentication flow includes:

```text
User
  ↓
Registration / Login
  ↓
FastAPI Authentication
  ↓
JWT Token
  ↓
Authenticated API Requests
  ↓
Role-Based Access
```

The application supports the following project roles:

```text
Customer
Agent
Reviewer
Manager
Admin
```

Access to protected functionality is controlled according to the user's role.

---

# 16. Complaint Processing Flow

The main complaint-processing workflow follows a structured pipeline.

```text
Customer Complaint
        ↓
Input Validation
        ↓
Complaint Preprocessing
        ↓
Complaint Storage
        ↓
Machine Learning Classification
        ↓
Python Rule Engine
        ↓
Policy / Resolution Processing
        ↓
Department Routing
        ↓
Escalation Evaluation
        ↓
Optional Generative AI
        ↓
Structured AI Output
        ↓
Output Guard / Schema Validation
        ↓
Analysis Storage
        ↓
Review / Resolution Workflow
```

The system is designed so that Generative AI is not treated as the only source of truth.

---

# 17. Generative AI Configuration

Generative AI processing is optional.

By default, it can remain disabled:

```env
OPENAI_ENABLED=false
```

When using an OpenAI-compatible integration, configure:

```env
OPENAI_ENABLED=true
OPENAI_API_KEY=your_api_key
```

Restart the backend after changing environment variables.

> Never place an API key directly inside source code or commit it to Git.

---

# 18. Main API Endpoints

The backend exposes endpoints including:

### Health

```http
GET /api/health
```

### Create Complaint

```http
POST /api/complaints
```

### Get Complaints

```http
GET /api/complaints
```

### Get Specific Complaint

```http
GET /api/complaints/{complaint_id}
```

### Get Complaint Analysis

```http
GET /api/complaints/{complaint_id}/analysis
```

Authentication endpoints include:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

For the complete list of available endpoints, open:

```text
http://localhost:8000/docs
```

---

# 19. Testing the Application

After starting both servers:

### Step 1

Open:

```text
http://localhost:5173
```

### Step 2

Register or log in to an account.

### Step 3

Create a complaint.

### Step 4

Allow the backend to process the complaint.

### Step 5

Open the complaint details and review the generated analysis.

The API can also be tested directly through:

```text
http://localhost:8000/docs
```

---

# 20. Common Problems

## Problem 1 — `ModuleNotFoundError`

Make sure the virtual environment is active:

```bash
.venv\Scripts\activate
```

Then reinstall dependencies:

```bash
pip install -r requirements.txt
```

---

## Problem 2 — MongoDB Connection Error

Check:

```env
MONGO_URI=...
```

Make sure:

* The connection string is correct.
* Your MongoDB Atlas cluster is available.
* Your network/IP is allowed by MongoDB Atlas.
* The username and password are correct.
* The database connection string is not malformed.

---

## Problem 3 — ML Model Not Found

Run:

```bash
python ml/train.py
```

Then restart the backend:

```bash
python -m uvicorn api.main:app --reload
```

---

## Problem 4 — Frontend Dependencies Missing

From the frontend directory:

```bash
cd frontend
npm install
```

Then:

```bash
npm run dev
```

---

## Problem 5 — Frontend Cannot Reach Backend

Make sure the backend is running:

```text
http://localhost:8000
```

Check:

```text
http://localhost:8000/api/health
```

Then make sure the frontend is running:

```text
http://localhost:5173
```

Also verify the project's API base/proxy configuration.

---

## Problem 6 — Port Already in Use

If port `8000` is already being used, stop the previous backend process or start Uvicorn on another port.

Example:

```bash
python -m uvicorn api.main:app --reload --port 8001
```

If the backend port changes, make sure the frontend API configuration matches it.

---

# 21. Development Commands

## Backend

Activate environment:

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Train models:

```bash
python ml/train.py
```

Run backend:

```bash
python -m uvicorn api.main:app --reload
```

---

## Frontend

Move to frontend:

```bash
cd frontend
```

Install packages:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

---

# 22. Documentation

Additional project documentation is available in:

```text
docs/
```

The main developer documentation is:

```text
docs/DEVELOPER_GUIDE.md
```

The developer guide provides deeper information about the system architecture, processing pipeline, components, data flow, validation, and implementation.

---

# 23. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │      Frontend       │
                    │ React + TypeScript  │
                    │       + Vite        │
                    └──────────┬──────────┘
                               │
                               │ HTTP / JSON
                               ↓
                    ┌─────────────────────┐
                    │      FastAPI        │
                    │      Backend        │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ↓                ↓                ↓
       ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
       │ ML / Rules  │  │  GenAI      │  │  MongoDB    │
       │   Engine    │  │  Pipeline   │  │    Atlas    │
       └─────────────┘  └─────────────┘  └─────────────┘
              │                │
              └────────┬───────┘
                       ↓
               ┌───────────────┐
               │   Validation  │
               │ & Output Guard│
               └───────┬───────┘
                       ↓
               ┌───────────────┐
               │ Complaint     │
               │ Analysis      │
               └───────────────┘
```

---

# 24. Quick Start

For developers who already have Python, Node.js, and MongoDB configured, the shortest setup is:

### 1. Clone

```bash
git clone <YOUR_REPOSITORY_URL>
cd SupportNova
```

### 2. Create environment

```bash
python -m venv .venv
```

### 3. Activate

```bash
.venv\Scripts\activate
```

### 4. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure `.env`

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET_KEY=your_secret
CORS_ORIGINS=http://localhost:5173
OPENAI_ENABLED=false
OPENAI_API_KEY=
SUPPORTNOVA_PROMPT_VERSION=1.0
```

### 6. Train models

```bash
python ml/train.py
```

### 7. Start backend

```bash
python -m uvicorn api.main:app --reload
```

### 8. Open another terminal

```bash
cd frontend
npm install
npm run dev
```

### 9. Open the application

```text
http://localhost:5173
```

### 10. Backend API documentation

```text
http://localhost:8000/docs
```

---

# 25. SupportNova

SupportNova combines conventional software engineering, machine-learning classification, deterministic business rules, optional Generative AI, structured validation, authentication, and persistent data storage into a single complaint-resolution workflow.

The project is designed to demonstrate how Generative AI can be incorporated into a customer-support system while maintaining structured processing, validation, and controlled business logic.
