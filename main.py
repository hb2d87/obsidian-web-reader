from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import json

app = FastAPI()

# Vault path - will be mounted in container
VAULT_PATH = "/vault"

class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: List['FileItem'] = []

# Recursive function to build file tree
def build_file_tree(root_path: str, relative_path: str = "") -> List[FileItem]:
    items = []
    full_path = os.path.join(root_path, relative_path) if relative_path else root_path
    
    if not os.path.exists(full_path):
        return items
    
    try:
        for item in sorted(os.listdir(full_path)):
            # Skip hidden files/directories except .metadata
            if item.startswith('.') and item != '.metadata':
                continue
                
            item_path = os.path.join(relative_path, item) if relative_path else item
            full_item_path = os.path.join(full_path, item)
            is_dir = os.path.isdir(full_item_path)
            
            file_item = FileItem(
                name=item,
                path=item_path,
                is_dir=is_dir
            )
            
            if is_dir:
                file_item.children = build_file_tree(root_path, item_path)
            
            items.append(file_item)
    except PermissionError:
        pass
    
    return items

@app.get("/api/files")
async def get_files():
    """Get all files recursively with folder structure"""
    try:
        files = build_file_tree(VAULT_PATH)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/file")
async def get_file(path: str):
    """Read file content"""
    try:
        full_path = os.path.join(VAULT_PATH, path)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/file")
async def save_file(path: str, content: str):
    """Write file content"""
    try:
        full_path = os.path.join(VAULT_PATH, path)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vault-name")
async def get_vault_name():
    """Get vault folder name"""
    try:
        vault_name = os.path.basename(os.path.normpath(VAULT_PATH))
        # Try to get a more descriptive name from .metadata if available
        metadata_path = os.path.join(VAULT_PATH, '.metadata', 'vault-config.md')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('- **Name:**'):
                        vault_name = line.split('**Name:**')[1].strip()
                        break
        return {"name": vault_name}
    except Exception as e:
        return {"name": "Obsidian Vault"}

# Serve static files
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")