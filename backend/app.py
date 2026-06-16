import os
import sys
# Force pure-Python protobuf implementation and block incompatible C-extension on Python 3.14
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
sys.modules["google._upb._message"] = None

import threading
import uuid
import json



import shutil
import tempfile
import traceback
import zipfile
import io
import requests

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv


from agent import run_agentic_analysis, run_pdf_analysis, LLMInterface, AgentLogger

load_dotenv()

# Configure static folder for serving React assets in production
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
if not os.path.exists(static_dir):
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))

app = Flask(__name__, static_folder=static_dir, static_url_path='/')
CORS(app)

# In-memory dictionary to store task statuses
# Format: { task_id: { "status": "pending|running|completed|failed", "logs": [], "result": None, "error": None } }
TASKS = {}
TASKS_LOCK = threading.Lock()

def get_task(task_id):
    with TASKS_LOCK:
        return TASKS.get(task_id)

def set_task(task_id, data):
    with TASKS_LOCK:
        if task_id not in TASKS:
            TASKS[task_id] = {}
        TASKS[task_id].update(data)

def run_repo_task_background(task_id, repo_url, provider, api_key, model_name):
    # Set status to running
    set_task(task_id, {"status": "running"})
    
    logger = AgentLogger(
        callback=lambda msg: set_task(task_id, {"logs": get_task(task_id)["logs"] + [msg]})
    )
    
    temp_dir = None
    try:
        # Step 1: Initialize LLM
        logger.log(f"Initializing LLM interface using {provider}...")
        llm = LLMInterface(provider, api_key, model_name)
        
        # Step 2: Fetch Repo
        temp_dir = tempfile.mkdtemp(prefix="repolens_")
        workspace_dir = temp_dir
        
        logger.log(f"Attempting to clone GitHub repository: {repo_url}...")
        result = subprocess_clone(repo_url, temp_dir, logger)
        
        if not result:
            logger.log("Git clone failed (or Git is not installed). Falling back to HTTP ZIP download...")
            # Re-create directory to make sure it's clean
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            temp_dir = tempfile.mkdtemp(prefix="repolens_")
            workspace_dir = temp_dir
            
            download_success = download_github_zip(repo_url, temp_dir, logger)
            if not download_success:
                raise Exception("Failed to clone repository or download zipball. Please check if the repository is public and your internet connection is active.")
            
            # Find the extracted root directory inside temp_dir (GitHub zipballs contain a single outer directory)
            extracted_items = os.listdir(temp_dir)
            if len(extracted_items) == 1 and os.path.isdir(os.path.join(temp_dir, extracted_items[0])):
                workspace_dir = os.path.join(temp_dir, extracted_items[0])
                logger.log(f"Using extracted subfolder as workspace root: {extracted_items[0]}")
            
        # Step 3: Run Agentic Analysis
        report = run_agentic_analysis(workspace_dir, llm, logger)
        
        # Step 4: Complete Task
        set_task(task_id, {
            "status": "completed",
            "result": report
        })
        logger.log("Task completed successfully!")
        
    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        logger.log(f"Task failed with error: {error_msg}")
        clean_error = "Repository analysis failed. Please verify your backend/.env configuration settings (LLM Provider, API Key, and Model settings) and check your internet connection."
        set_task(task_id, {
            "status": "failed",
            "error": clean_error
        })
    finally:
        # Cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                logger.log("Cleaning up temporary workspace files...")
                shutil.rmtree(temp_dir)
            except Exception as clean_err:
                print(f"Error cleaning temp dir {temp_dir}: {clean_err}")

def run_pdf_task_background(task_id, pdf_path, provider, api_key, model_name):
    set_task(task_id, {"status": "running"})
    
    logger = AgentLogger(
        callback=lambda msg: set_task(task_id, {"logs": get_task(task_id)["logs"] + [msg]})
    )
    
    try:
        logger.log(f"Initializing LLM interface using {provider}...")
        llm = LLMInterface(provider, api_key, model_name)
        
        report = run_pdf_analysis(pdf_path, llm, logger)
        
        set_task(task_id, {
            "status": "completed",
            "result": report
        })
        logger.log("Task completed successfully!")
        
    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        logger.log(f"Task failed with error: {error_msg}")
        clean_error = "PDF report analysis failed. Please verify your backend/.env configuration settings (LLM Provider, API Key, and Model settings) and check your PDF file format."
        set_task(task_id, {
            "status": "failed",
            "error": clean_error
        })
    finally:
        # Delete the uploaded temporary PDF
        if pdf_path and os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except Exception as e:
                print(f"Error removing temp pdf {pdf_path}: {e}")

def subprocess_clone(repo_url, target_dir, logger):
    """Clones git repo using a sub-process."""
    try:
        # Command: git clone --depth 1 <repo_url> <target_dir>
        cmd = ["git", "clone", "--depth", "1", repo_url, target_dir]
        logger.log(f"Running command: {' '.join(cmd)}")
        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        if process.returncode != 0:
            logger.log(f"Git Clone Error: {process.stderr}")
            return False
        return True
    except Exception as e:
        logger.log(f"Git execution failed: {str(e)}")
        return False

def download_github_zip(repo_url, target_dir, logger):
    """Downloads repository as a ZIP archive directly from the GitHub API and extracts it."""
    try:
        # Clean URL
        clean_url = repo_url.rstrip('/')
        if clean_url.endswith('.git'):
            clean_url = clean_url[:-4]
            
        parts = clean_url.split('/')
        if len(parts) < 5:
            logger.log("Invalid GitHub URL format.")
            return False
            
        owner = parts[-2]
        repo = parts[-1]
        
        # GitHub API redirects zipball to the default branch's zip archive
        zip_url = f"https://api.github.com/repos/{owner}/{repo}/zipball"
        logger.log(f"Downloading repository zipball from GitHub API: {zip_url}...")
        
        headers = {"User-Agent": "RepoLENS-Agent"}
        response = requests.get(zip_url, headers=headers, stream=True, timeout=60)
        
        if response.status_code != 200:
            logger.log(f"Failed to download zipball. HTTP Status: {response.status_code}")
            return False
            
        logger.log("Extracting zipball archive...")
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(target_dir)
            
        logger.log("Extraction completed successfully.")
        return True
    except Exception as e:
        logger.log(f"Failed to download/extract zipball: {str(e)}")
        return False

def get_llm_config():
    provider = os.environ.get("LLM_PROVIDER", "gemini").lower()
    if provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        model_name = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    elif provider == "nvidia":
        api_key = os.environ.get("NVIDIA_API_KEY")
        model_name = os.environ.get("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")
    else:
        provider = "gemini"
        api_key = os.environ.get("GEMINI_API_KEY")
        model_name = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    return provider, api_key, model_name

# Import subprocess inside the function to ensure it is loaded
import subprocess

@app.route('/api/analyze', methods=['POST'])
def analyze_repo():
    data = request.json or {}
    repo_url = data.get("repoUrl")
    
    if not repo_url:
        return jsonify({"error": "repoUrl is required"}), 400
        
    provider, api_key, model_name = get_llm_config()
    if not api_key or "your_" in api_key or api_key.strip() == "":
        return jsonify({"error": f"API key for LLM Provider '{provider}' is not set in backend/.env file. Please edit backend/.env and add a valid key."}), 400
        
    task_id = str(uuid.uuid4())
    
    # Initialize task status
    with TASKS_LOCK:
        TASKS[task_id] = {
            "status": "pending",
            "logs": ["Task initialized in queue."],
            "result": None,
            "error": None
        }
        
    # Start thread
    thread = threading.Thread(
        target=run_repo_task_background,
        args=(task_id, repo_url, provider, api_key, model_name)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({"taskId": task_id})

@app.route('/api/analyze-pdf', methods=['POST'])
def analyze_pdf():
    if 'pdf' not in request.files:
        return jsonify({"error": "No PDF file uploaded"}), 400
        
    pdf_file = request.files['pdf']
    if pdf_file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    provider, api_key, model_name = get_llm_config()
    if not api_key or "your_" in api_key or api_key.strip() == "":
        return jsonify({"error": f"API key for LLM Provider '{provider}' is not set in backend/.env file. Please edit backend/.env and add a valid key."}), 400

    # Save the file to a temporary location
    temp_fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    os.close(temp_fd)
    pdf_file.save(temp_path)
    
    task_id = str(uuid.uuid4())
    
    with TASKS_LOCK:
        TASKS[task_id] = {
            "status": "pending",
            "logs": ["PDF Task initialized in queue."],
            "result": None,
            "error": None
        }
        
    # Start thread
    thread = threading.Thread(
        target=run_pdf_task_background,
        args=(task_id, temp_path, provider, api_key, model_name)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({"taskId": task_id})

@app.route('/api/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)

@app.route('/api/interview/review', methods=['POST'])
def review_answer():
    data = request.json or {}
    question = data.get("question")
    model_answer = data.get("modelAnswer")
    user_answer = data.get("userAnswer")
    
    if not all([question, model_answer, user_answer]):
        return jsonify({"error": "question, modelAnswer, and userAnswer are required"}), 400
        
    provider, api_key, model_name = get_llm_config()
    if not api_key or "your_" in api_key or api_key.strip() == "":
        return jsonify({"error": f"API key for LLM Provider '{provider}' is not configured in backend/.env."}), 400
        
    try:
        llm = LLMInterface(provider, api_key, model_name)
        
        system_prompt = (
            "You are an expert technical interviewer and AI mentor. You will evaluate the candidate's answer "
            "to a project-specific interview question against the correct model answer. Provide constructive "
            "feedback, grade the answer, and point out what is correct, what is missing, and how to improve it.\n"
            "You must return your feedback in a raw JSON object with this exact schema:\n"
            "{\n"
            "  \"score\": 75, // A score out of 100\n"
            "  \"feedback\": \"Constructive evaluation paragraph...\",\n"
            "  \"whatWasGood\": \"Points the candidate covered well...\",\n"
            "  \"howToImprove\": \"Specific concepts or details they missed that would make their answer stronger.\"\n"
            "}"
        )
        
        user_prompt = f"""
Question: {question}
Expected / Model Answer: {model_answer}
Candidate's Answer: {user_answer}

Provide a fair grade and detailed feedback.
"""
        
        response_str = llm.call(system_prompt, user_prompt, response_json=True)
        feedback_json = json.loads(response_str)
        return jsonify(feedback_json)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to evaluate answer. Please verify your backend/.env configurations (LLM Provider and API Key) and ensure your server has internet access."}), 500


@app.route('/api/interview/answer', methods=['POST'])
def get_interview_answer():
    data = request.json or {}
    question = data.get("question")
    
    if not question:
        return jsonify({"error": "question is required"}), 400
        
    provider, api_key, model_name = get_llm_config()
    if not api_key or "your_" in api_key or api_key.strip() == "":
        return jsonify({"error": f"API key for LLM Provider '{provider}' is not configured in backend/.env."}), 400
        
    try:
        llm = LLMInterface(provider, api_key, model_name)
        
        system_prompt = (
            "You are an expert technical interviewer and senior developer. For the given technical interview "
            "question, provide a detailed, comprehensive model answer. Explain the concepts clearly and "
            "provide best practices."
        )
        user_prompt = f"Provide a detailed model answer for this interview question: {question}"
        
        response_str = llm.call(system_prompt, user_prompt, response_json=False)
        return jsonify({"answer": response_str})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate model answer. Please verify your backend/.env configurations."}), 500



@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Run the server on the port specified by environment variables (Render sets PORT)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
