# RepoLENS: Codebase Analysis and Technical Evaluation System

**RepoLENS** is an automated system designed for codebase parsing, structural mapping, and technical proficiency evaluation. By extracting data from public GitHub repositories or parsing project documentation (PDF), the system constructs a dependency matrix, identifies technological stacks, and utilizes an AI agent to generate and evaluate domain-specific technical queries in a simulated environment.

---

## **Live** : https://repolens-0su3.onrender.com


## System Architecture & Core Capabilities

1. **Repository Parsing Engine**: Crawls public GitHub directories to construct a structural map, inspect entry points, parse dependency trees, and analyze component hierarchies.
2. **Documentation Synthesis**: Parses uploaded project documentation to extract technology stacks, architectural constraints, and developmental roadmaps.
3. **Hierarchical Tree Explorer**: Renders an interactive project directory structure utilizing visual state indicators and nesting parameters.
4. **Execution State & Log Console**: Provides real-time execution tracking (cloning, mapping, inspection, synthesis) with raw system logs.
   * **Stateful Auto-Scroll**: Implements conditional scroll locking based on user viewport position.
   * **Path Sanitization**: Masks local environment variables and host paths (e.g., `<temp_workspace>`) to maintain environment security.
5. **Simulated Evaluation Environment**: Generates project-specific technical queries derived from the codebase schema.
   * **Markdown Renderer**: Formats expected outputs, code blocks, and structural data.
   * **Heuristic Evaluation**: Scores user input against generated model answers using defined performance criteria.
   * **State Persistence**: Maintains local session data for draft inputs, view states, and evaluation metrics across component unmounts.
6. **Frontend Architecture**: Developed utilizing React and standard CSS, optimized for responsive layout and minimal DOM overhead.

---

## Autonomous ReAct (Reasoning + Action) Engine

The system implements an autonomous ReAct loop for repository inspection. The engine executes a multi-turn inference cycle utilizing directory-level tool calling rather than static file scanning.

```text
   ┌──────────────────────────────┐
   │          Input Vector        │
   │ (GitHub URL / Project PDF)   │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │    Data Extraction Layer     │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │    Agentic Loop (ReAct)      │
   │                              │
   │  Available Tools:            │
   │  - list_all_files()          │
   │  - read_file_content()       │
   │  - search_keyword()          │
   │                              │
   │  Execution Cycle:            │
   │  1. Map directory structure  │
   │  2. Identify critical nodes  │
   │  3. Extract node payloads    │
   │  4. Validate data sufficiency│
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │    LLM Inference Engine      │
   │  Output: Schema & Query Set  │
   └──────────────────────────────┘
```

### Callable Agent Tools

* **`list_all_files()`**: Executes a recursive traversal of the root directory to generate a flattened structural array.
* **`read_file_content(filepath)`**: Dynamically extracts string payloads from designated configuration and entry-point files (e.g., `package.json`, route configurations).
* **`search_keyword(query)`**: Executes pattern matching across the workspace to identify specific environmental configurations or database schemas.

### Inference Pipeline

1. **Discovery**: Executes `list_all_files()` to compile the directory structure.
2. **Heuristic Assessment**: Identifies standard configuration nodes (`requirements.txt`, `composer.json`, `Cargo.toml`).
3. **Iterative Extraction**: Invokes `read_file_content()` on selected nodes to synthesize an architectural model of the repository.
4. **Synthesis**: Compiles the final architectural report and generates domain-specific evaluation parameters.

---

## Directory Structure

```text
RepoLens/
├── backend/                  # Flask WSGI & Inference Engine
│   ├── app.py                # Process manager and API routing
│   ├── agent.py              # Crawler, file filter, and ReAct loop logic
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Environment variables
├── frontend/                 # Vite + React SPA
│   ├── src/
│   │   ├── components/       # UI Component modules
│   │   ├── App.jsx           # Core router and state management
│   │   ├── App.css           # Component stylesheets
│   │   └── index.css         # Global variables
│   ├── dist/                 # Compiled static assets
│   └── package.json          # Node dependencies and build scripts
├── Dockerfile                # Multi-stage containerization script
└── .dockerignore             # Build context exclusions
```

---

## Environment Configuration & Deployment

### 1. Environment Variables

Define the following parameters in `backend/.env`:

```env
# Define LLM runtime environment: 'gemini' or 'nvidia'
LLM_PROVIDER=nvidia

# Google Gemini Configuration:
GEMINI_API_KEY=<your_api_key>
GEMINI_MODEL=gemini-1.5-flash

# NVIDIA NIM Configuration:
NVIDIA_API_KEY=<your_api_key>
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
```

### 2. Backend Initialization (Flask)

1. Initialize the Python environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Unix
.\venv\Scripts\activate   # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Execute the WSGI server:
```bash
python app.py
```

*Service binds to `http://127.0.0.1:5000`.*

### 3. Frontend Initialization (Vite/React)

1. Navigate to the client directory:
```bash
cd frontend
```

2. Resolve node dependencies:
```bash
npm install
```

3. Compile static assets:
```bash
npm run build
```

*Output is generated in `frontend/dist` for backend proxy serving.*

4. Initialize development server (optional):
```bash
npm run dev
```

---

## Containerization

The repository includes a multi-stage Dockerfile for unified port deployment.

### 1. Image Compilation

Execute from the project root:

```bash
docker build -t repolens:latest .
```

### 2. Container Execution

Bind port `5000` and inject the environment configuration:

```bash
docker run -p 5000:5000 --env-file ./backend/.env repolens:latest
```

---

## Cloud Infrastructure Deployment

For PaaS platforms (e.g., Render) utilizing Docker runtimes:

1. Connect the source repository to the deployment platform.
2. Configure the runtime environment to `Docker`.
3. Inject the required environment variables (`LLM_PROVIDER`, `<PROVIDER>_API_KEY`, `<PROVIDER>_MODEL`) via the platform's configuration console.
4. The platform will automatically execute the image build and initiate the Gunicorn/Flask instance.