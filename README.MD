# RepoLENS

RepoLENS is an AI-powered project reviewer, codebase mapper, and interactive interview preparation arena. By crawling a public GitHub repository or parsing an uploaded project PDF report, RepoLENS constructs a comprehensive codebase mapping, extracts structural and data flows, detects technology stacks, and generates project-specific mock interview questions with live AI answer evaluation.

---

## Key Features

1. **Repository Analyzer**: Crawls and maps public GitHub directories, inspects code entry points, parses dependency trees, and analyzes codebase components.
2. **Project PDF Analyzer**: Parses and evaluates uploaded project reports or PDFs to compile tech stacks and developmental roadmaps.
3. **Dynamic Stepper & Logs**: Provides a live visual stepper tracking analysis progress (cloning, structure mapping, file inspection, and synthesis) along with raw agent logs.
4. **Interview Arena**: Simulates technical interviews using custom questions generated directly from your project's codebase. Features:
   - **On-Demand Answers**: Discloses suggested mentor answers only when requested to optimize token usage.
   - **AI Interviewer Review**: Evaluates user answers against model answers and scores them with detailed criteria (What You Did Well, How to Improve).
5. **Glassmorphic UI**: High-fidelity, minimal, responsive dashboard built with Vite, React, and Vanilla CSS.
6. **Multi-User Ready**: Backend built with isolated temp folders per request, thread-safe background workers, and Gunicorn-optimized architecture.

---

## Agentic AI Workflow & Engine

RepoLENS implements an autonomous **ReAct (Reasoning + Action) Agentic Loop** to inspect repositories. Instead of scanning files blindly, the engine initiates a multi-turn conversation with the LLM where the model behaves as an agent equipped with directory-level tools.

```text
                  ┌─────────────────────────────┐
                  │          User Input         │
                  │ (GitHub URL / Project PDF)  │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │     Clone Repo / PDF Text   │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │    Agentic Loop (ReAct)     │
                  │                             │
                  │  Available Tools:           │
                  │  - list_all_files()         │
                  │  - read_file_content()      │
                  │  - search_keyword()         │
                  │                             │
                  │  Loop:                      │
                  │  1. Scan tree structure     │
                  │  2. Decide important files  │
                  │  3. Read file contents      │
                  │  4. Check if info is enough │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │    LLM Reasoning Engine     │
                  │   Generate Report & Q&A     │
                  └─────────────────────────────┘
```

### Agent Tools
- **`list_all_files()`**: Traverses the root and subdirectories to build a flattened view of all files and folders.
- **`read_file_content(filepath)`**: Dynamically loads and extracts content from specific scripts (e.g. `package.json`, main entry point files, backend route configs).
- **`search_keyword(query)`**: Scans for specific configuration patterns or database setups across the workspace.

### The Reasoning Loop
1. **Directory Discovery**: The Agent runs `list_all_files()` to explore the layout.
2. **Heuristic Evaluation**: The Agent identifies key setup configs (like `requirements.txt`, `composer.json`, `Cargo.toml`).
3. **Iterative Tool Calling**: The Agent decides which source files to inspect based on its findings, loops through them using `read_file_content()`, and synthesizes a mental model of the codebase architecture.
4. **Synthesis & Q&A Compilation**: Once it completes reasoning, the Agent generates a detailed mentorship report and constructs 3 to 4 domain-specific interview questions.

---

## Repository Structure

```text
RepoLENS2/
├── backend/                  # Flask REST API & AI Agent Engine
│   ├── app.py                # Main server, queue manager, and routing
│   ├── agent.py              # Git/ZIP crawler, file filter, and ReAct agent loop
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Vite + React Client
│   ├── src/
│   │   ├── components/       # UI Components (RepoAnalyzer, PdfAnalyzer, InterviewTrainer)
│   │   ├── App.jsx           # Core layout and tab controller
│   │   ├── App.css           # Glassmorphic responsive styling
│   │   └── index.css         # Typography and global variables
│   └── package.json          # Node configurations
├── Dockerfile                # Multi-stage Docker build config
└── .dockerignore             # Docker build exclusions
```

---

## Local Installation & Development

### Backend (Flask Server)
1. Navigate to the `/backend` folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file inside the `backend` directory:
   ```env
   # Choose LLM provider: 'gemini' or 'nvidia'
   LLM_PROVIDER=gemini
   
   # If using Google Gemini:
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   
   # If using NVIDIA NIM:
   NVIDIA_API_KEY=your_nvidia_api_key_here
   NVIDIA_MODEL=meta/llama-3.1-8b-instruct
   ```
5. Run the development server:
   ```bash
   python app.py
   ```
   The backend will start on `http://127.0.0.1:5000`.

### Frontend (Vite React Client)
1. Navigate to the `/frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install package dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The client will boot on `http://localhost:5173`. Vite is pre-configured to proxy `/api` requests automatically to the Flask backend on port `5000`.

---

## Containerization with Docker

RepoLENS is configured with a multi-stage Docker build that bundles the frontend compilation and runs the production Flask backend on a single unified port.

### 1. Build the Docker Image
From the root directory of the project, run:
```bash
docker build -t repolens:latest .
```

### 2. Run the Container Locally
To run the container, exposing the application on port `5000` and passing your local environmental keys:
```bash
docker run -p 5000:5000 --env-file ./backend/.env repolens:latest
```
Visit `http://localhost:5000` to interact with the application.

---

##  Cloud Deployment (e.g., Render)

Render and similar PaaS platforms support direct deployment of Docker containers:

1. Push the codebase to a GitHub repository.
2. In the **Render Dashboard**, select **New Web Service** and connect your repository.
3. Set **Language/Runtime** to `Docker`.
4. Add the required environment variables in the **Environment** section:
   - `LLM_PROVIDER` (e.g., `gemini` or `nvidia`)
   - `GEMINI_API_KEY` / `NVIDIA_API_KEY`
   - `GEMINI_MODEL` / `NVIDIA_MODEL`
5. Render will automatically build the image and spin up the Gunicorn server.