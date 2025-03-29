import requests
import json
from typing import Dict

def is_valid_json(response: str) -> bool:
    """Check if the response is a valid JSON string."""
    try:
        # First try to extract JSON from markdown code blocks if present
        if "```json" in response and "```" in response.split("```json", 1)[1]:
            json_content = response.split("```json", 1)[1].split("```", 1)[0].strip()
            json.loads(json_content)
            return True
        # If no code blocks or extraction failed, try parsing the whole response
        else:
            json.loads(response)
            return True
    except ValueError:
        return False

def parse_json_response(response):
    """Parse JSON from LLM response, handling markdown code blocks."""
    if "```json" in response and "```" in response.split("```json", 1)[1]:
        # Extract JSON from markdown code blocks
        json_content = response.split("```json", 1)[1].split("```", 1)[0].strip()
        return json.loads(json_content)
    else:
        # Try parsing the whole response
        return json.loads(response)

def query_ollama(prompt: str, model: str = "gemma3") -> Dict:
    """Send a query to Ollama and return the parsed response."""
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()['response']
        
    except Exception as e:
        print(f"Error querying Ollama: {str(e)}")
        return {}

