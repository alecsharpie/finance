import requests
import json
from typing import Dict

def query_ollama(prompt: str, model: str = "gemma2:9b") -> Dict:
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
    
def parse_json_response(response):
    return json.loads(response.replace('```json\n', '').replace('\n```', ''))

