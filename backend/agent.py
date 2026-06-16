import os
import sys
# Force pure-Python protobuf implementation and block incompatible C-extension on Python 3.14
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
sys.modules["google._upb._message"] = None

import shutil
import subprocess


import tempfile
import json
import traceback
from pypdf import PdfReader
import google.generativeai as genai
from openai import OpenAI

# Excluded directories and file patterns to prevent bloated context and keep search fast
EXCLUDED_DIRS = {
    '.git', 'node_modules', 'bower_components', 'venv', '.venv', 'env', '.env',
    '__pycache__', '.pytest_cache', '.idea', '.vscode', 'build', 'dist', 'target',
    'out', 'bin', 'obj', 'vendor'
}

EXCLUDED_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', '.mp3', '.pdf', '.zip',
    '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2',
    '.ttf', '.eot', '.class', '.pyc', '.db', '.sqlite', '.sqlite3', '.lock', '-lock.json'
}

class AgentLogger:
    def __init__(self, callback=None):
        self.logs = []
        self.callback = callback

    def log(self, message):
        self.logs.append(message)
        print(f"[AgentLog] {message}")
        if self.callback:
            try:
                self.callback(message)
            except Exception as e:
                print(f"Callback error: {e}")

def get_file_tree(dir_path):
    """Generates a hierarchical directory tree as a dict/list for frontend and LLM context."""
    tree = {}
    for root, dirs, files in os.walk(dir_path):
        # Modify dirs in-place to avoid scanning excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        
        # Calculate relative path
        rel_path = os.path.relpath(root, dir_path)
        if rel_path == '.':
            current_node = tree
        else:
            parts = rel_path.split(os.sep)
            current_node = tree
            for part in parts:
                if part not in current_node:
                    current_node[part] = {}
                current_node = current_node[part]
                
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in EXCLUDED_EXTENSIONS and not file.startswith('.'):
                current_node[file] = None # Leaf node represents a file
                
    return tree

def get_flat_file_list(dir_path):
    """Returns a list of relative file paths that are allowed to be read."""
    file_list = []
    for root, dirs, files in os.walk(dir_path):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in EXCLUDED_EXTENSIONS and not file.startswith('.'):
                rel_path = os.path.relpath(os.path.join(root, file), dir_path)
                file_list.append(rel_path.replace(os.sep, '/'))
    return file_list

def read_file_content(dir_path, rel_path, max_chars=30000):
    """Reads the content of a file up to max_chars to avoid hitting context limits."""
    abs_path = os.path.join(dir_path, rel_path.replace('/', os.sep))
    # Security: check if path is within directory
    real_dir = os.path.realpath(dir_path)
    real_file = os.path.realpath(abs_path)
    if not real_file.startswith(real_dir):
        return f"Error: Access denied to path {rel_path}"
        
    if not os.path.exists(abs_path):
        return f"Error: File {rel_path} does not exist"
        
    try:
        with open(abs_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(max_chars)
            if len(content) >= max_chars:
                content += "\n... [TRUNCATED DUE TO SIZE] ..."
            return content
    except Exception as e:
        return f"Error reading file {rel_path}: {str(e)}"

def extract_pdf_text(pdf_path):
    """Extracts text from a local PDF file."""
    reader = PdfReader(pdf_path)
    text = []
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text()
        if page_text:
            text.append(f"--- Page {i+1} ---\n{page_text}")
    return "\n\n".join(text)

class LLMInterface:
    def __init__(self, provider, api_key, model_name=None):
        self.provider = provider
        self.api_key = api_key
        
        if provider == 'gemini':
            genai.configure(api_key=api_key)
            self.model_name = model_name or 'gemini-1.5-flash'
        elif provider == 'nvidia':
            self.model_name = model_name or 'meta/llama-3.1-70b-instruct'
            self.client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=api_key
            )
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    def call(self, system_prompt, user_prompt, response_json=False):
        if self.provider == 'gemini':
            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_prompt
            )
            config = {}
            if response_json:
                config["response_mime_type"] = "application/json"
            
            response = model.generate_content(user_prompt, generation_config=config)
            return response.text
        else: # NVIDIA NIM (using openai compatible API)
            kwargs = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            }
            if response_json:
                kwargs["response_format"] = {"type": "json_object"}
                
            completion = self.client.chat.completions.create(**kwargs)
            return completion.choices[0].message.content

def run_agentic_analysis(workspace_dir, llm, logger):
    """Runs the multi-step agentic codebase analysis."""
    logger.log("Starting repository mapping...")
    
    # Get all files
    flat_files = get_flat_file_list(workspace_dir)
    tree = get_file_tree(workspace_dir)
    
    logger.log(f"Detected {len(flat_files)} relevant files in repository.")
    
    # Automatically read important configuration & documentation files first
    important_keywords = ['readme', 'package.json', 'requirements.txt', 'pom.xml', 
                          'cargo.toml', 'go.mod', 'composer.json', 'gemfile', 'dockerfile']
    
    initial_context = {}
    for f in flat_files:
        filename_lower = os.path.basename(f).lower()
        if any(kw in filename_lower for kw in important_keywords):
            logger.log(f"Automatically inspecting key file: {f}")
            content = read_file_content(workspace_dir, f, max_chars=10000)
            initial_context[f] = content

    logger.log("Querying Agent Reasoning Loop to identify critical source code files for deep inspection...")
    
    system_prompt = (
        "You are an autonomous AI Repository Inspector Agent. Your job is to select the most critical "
        "source code files (e.g. main application entry points, controllers, core models, service layers) "
        "to inspect in order to understand the architecture and core features of this repository.\n"
        "You must return your choice in a raw JSON object containing the key 'inspect_files' which is a list "
        "of relative file paths from the provided file list. Select between 4 to 12 files. Avoid selecting lockfiles, "
        "tests, or documentation, focus strictly on core implementation code."
    )
    
    user_prompt = f"""
Here is the complete list of files in the repository:
{json.dumps(flat_files, indent=2)}

Here are the contents of the basic configuration/documentation files we read automatically:
{json.dumps(initial_context, indent=2)}

Autonomously select the list of core implementation files that are crucial for understanding the logic of this application.
Return JSON format: {{"inspect_files": ["path/to/file1", "path/to/file2"]}}
"""
    
    try:
        response_str = llm.call(system_prompt, user_prompt, response_json=True)
        # Parse JSON
        decision = json.loads(response_str)
        files_to_read = decision.get("inspect_files", [])
        logger.log(f"Agent decided to inspect: {', '.join(files_to_read)}")
    except Exception as e:
        logger.log(f"Agent reasoning failed: {str(e)}. Falling back to default heuristics.")
        # Fallback heuristic: pick first few python/js/go files
        files_to_read = []
        priority_exts = ['.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.java', '.cs', '.cpp', '.php']
        for f in flat_files:
            ext = os.path.splitext(f)[1].lower()
            if ext in priority_exts and not any(kw in f.lower() for kw in ['test', 'spec', 'config']):
                files_to_read.append(f)
                if len(files_to_read) >= 8:
                    break

    # Read the chosen files
    detailed_context = {}
    for f in files_to_read:
        if f in flat_files:
            logger.log(f"Deeply inspecting code file: {f}")
            content = read_file_content(workspace_dir, f, max_chars=12000)
            detailed_context[f] = content
        else:
            logger.log(f"Warning: Agent requested file {f} but it was not found.")

    logger.log("Analyzing codebase content, architecture, and technology stack...")
    
    synthesis_system_prompt = (
        "You are an expert AI software architect and mentor. Analyze the provided codebase files and directory structure "
        "to generate a comprehensive evaluation report. Your output MUST be in valid JSON format. "
        "Ensure all JSON strings are properly escaped.\n"
        "The JSON MUST follow this exact schema:\n"
        "{\n"
        "  \"projectName\": \"Name of the project\",\n"
        "  \"summary\": \"A concise paragraph explaining the project's purpose and functionality.\",\n"
        "  \"difficultyLevel\": \"Beginner | Intermediate | Advanced\",\n"
        "  \"techStack\": {\n"
        "     \"languages\": [\"Python\", \"JavaScript\", etc],\n"
        "     \"frontend\": [\"React\", etc or null],\n"
        "     \"backend\": [\"Flask\", \"Express\", etc or null],\n"
        "     \"database\": [\"SQLite\", \"MongoDB\", etc or null],\n"
        "     \"other\": [\"Docker\", etc]\n"
        "  },\n"
        "  \"features\": [\n"
        "     { \"title\": \"Feature Title\", \"description\": \"Detailed description of what this feature does and where it is in the code\" }\n"
        "  ],\n"
        "  \"architecture\": {\n"
        "     \"structureDescription\": \"Explanation of the folder structure and layout.\",\n"
        "     \"dataFlow\": \"Explanation of how data flows through the application (frontend -> backend -> DB, etc).\"\n"
        "  },\n"
        "  \"missingComponents\": [\n"
        "     \"List any key missing elements (e.g. no unit tests, missing error handling, lack of API docs).\"\n"
        "  ],\n"
        "  \"improvementSuggestions\": [\n"
        "     { \"area\": \"Security | Code Quality | Documentation\", \"suggestion\": \"Actionable recommendation for enhancement.\" }\n"
        "  ],\n"
        "  \"learningRecommendations\": [\n"
        "     \"Skills or topics the student should learn next to extend or understand this project (e.g. JWT Auth, WebSockets).\"\n"
        "  ],\n"
        "  \"interviewQuestions\": [\n"
        "     \"Direct technical interview question about this project's code/architecture.\"\n"
        "  ]\n"
        "}"
    )

    synthesis_user_prompt = f"""
Analyze the following repository:
File Tree:
{json.dumps(tree, indent=2)}

Important Config Files and Readme:
{json.dumps(initial_context, indent=2)}

Deep-Inspected Source Files:
{json.dumps(detailed_context, indent=2)}

Generate the complete JSON evaluation report following the exact schema specified.
"""
    
    logger.log("Running LLM reasoning engine to synthesize evaluation report & generate project-specific interview questions...")
    
    try:
        report_str = llm.call(synthesis_system_prompt, synthesis_user_prompt, response_json=True)
        # Verify it parses as valid JSON
        report = json.loads(report_str)
        report["tree"] = tree
        logger.log("Report synthesized successfully!")
        return report
    except Exception as e:
        logger.log(f"Synthesis failed or JSON response was malformed: {str(e)}")
        # Attempt recovery or throw
        raise e

def run_pdf_analysis(pdf_path, llm, logger):
    """Orchestrates extraction and analysis of an uploaded PDF report."""
    logger.log("Extracting text from uploaded PDF project report...")
    pdf_text = extract_pdf_text(pdf_path)
    logger.log(f"Extracted {len(pdf_text)} characters of text from PDF.")
    
    synthesis_system_prompt = (
        "You are an expert AI software architect and mentor. Analyze the provided project report (PDF text) "
        "to generate a comprehensive evaluation report. Your output MUST be in valid JSON format. "
        "Ensure all JSON strings are properly escaped.\n"
        "The JSON MUST follow this exact schema:\n"
        "{\n"
        "  \"projectName\": \"Name of the project described in the PDF\",\n"
        "  \"summary\": \"A concise paragraph explaining the project's purpose and functionality based on the PDF.\",\n"
        "  \"difficultyLevel\": \"Beginner | Intermediate | Advanced\",\n"
        "  \"techStack\": {\n"
        "     \"languages\": [\"Python\", \"JavaScript\", etc],\n"
        "     \"frontend\": [\"React\", etc or null],\n"
        "     \"backend\": [\"Flask\", \"Express\", etc or null],\n"
        "     \"database\": [\"SQLite\", \"MongoDB\", etc or null],\n"
        "     \"other\": [\"Docker\", etc]\n"
        "  },\n"
        "  \"features\": [\n"
        "     { \"title\": \"Feature Title\", \"description\": \"Detailed description of what this feature does based on the report\" }\n"
        "  ],\n"
        "  \"architecture\": {\n"
        "     \"structureDescription\": \"Explanation of the architecture described in the report.\",\n"
        "     \"dataFlow\": \"Explanation of how data flows through the application according to the report.\"\n"
        "  },\n"
        "  \"missingComponents\": [\n"
        "     \"List any key missing elements or gaps noted in the report.\"\n"
        "  ],\n"
        "  \"improvementSuggestions\": [\n"
        "     { \"area\": \"Security | Code Quality | Documentation\", \"suggestion\": \"Actionable recommendation for enhancement based on the project report.\" }\n"
        "  ],\n"
        "  \"learningRecommendations\": [\n"
        "     \"Skills or topics the student should learn next to extend or understand this project.\"\n"
        "  ],\n"
        "  \"interviewQuestions\": [\n"
        "     \"Direct technical interview question about this project's architecture/concepts as described in the PDF.\"\n"
        "  ]\n"
        "}"
    )
    
    user_prompt = f"""
Here is the text extracted from the PDF project report:
{pdf_text}

Generate the complete JSON evaluation report following the exact schema specified.
"""
    
    logger.log("Running LLM reasoning engine to synthesize evaluation report from PDF text...")
    try:
        report_str = llm.call(synthesis_system_prompt, user_prompt, response_json=True)
        report = json.loads(report_str)
        report["tree"] = {"[Parsed from PDF Report]": None}
        logger.log("PDF Report synthesized successfully!")
        return report
    except Exception as e:
        logger.log(f"PDF Synthesis failed: {str(e)}")
        raise e
