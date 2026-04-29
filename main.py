from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import json
import shutil

app = FastAPI()

# Vault path - will be mounted in container
VAULT_PATH = "/vault"

def get_active_vault(request: Request) -> str:
    subpath = request.headers.get("x-vault-path", "")
    full_path = os.path.normpath(os.path.join(VAULT_PATH, subpath.strip('/')))
    if not full_path.startswith(VAULT_PATH):
        return VAULT_PATH
    return full_path

class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    mtime: float = 0.0
    children: List['FileItem'] = []

class RenameItem(BaseModel):
    old_path: str
    new_path: str

class RenameItem(BaseModel):
    old_path: str
    new_path: str

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
            
            # Get modified time
            mtime = 0.0
            try:
                mtime = os.path.getmtime(full_item_path)
            except OSError:
                pass
            
            file_item = FileItem(
                name=item,
                path=item_path,
                is_dir=is_dir,
                mtime=mtime
            )
            
            if is_dir:
                file_item.children = build_file_tree(root_path, item_path)
            
            items.append(file_item)
    except PermissionError:
        pass
    
    return items

@app.get("/api/vaults")
async def get_vaults():
    """Get all top-level directories to act as vaults"""
    vaults = ["/"]
    try:
        if os.path.exists(VAULT_PATH):
            for item in sorted(os.listdir(VAULT_PATH)):
                full_item = os.path.join(VAULT_PATH, item)
                if os.path.isdir(full_item) and not item.startswith('.'):
                    vaults.append(item)
    except:
        pass
    return {"vaults": vaults}

@app.get("/api/files")
async def get_files(request: Request):
    """Get all files recursively with folder structure"""
    try:
        active_vault = get_active_vault(request)
        files = build_file_tree(active_vault)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recent")
async def get_recent_files(request: Request):
    """Get top 10 recently modified markdown files"""
    try:
        active_vault = get_active_vault(request)
        all_md_files = []
        for root, dirs, files in os.walk(active_vault):
            # Skip hidden directories except .metadata
            dirs[:] = [d for d in dirs if not (d.startswith('.') and d != '.metadata')]
            
            for file in files:
                if file.endswith('.md') and not file.startswith('.'):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, active_vault)
                    try:
                        mtime = os.path.getmtime(full_path)
                        excerpt = ""
                        with open(full_path, 'r', encoding='utf-8') as f:
                            excerpt = f.read(150).replace('\n', ' ').strip()
                        all_md_files.append({
                            "name": file,
                            "path": rel_path,
                            "is_dir": False,
                            "mtime": mtime,
                            "excerpt": excerpt
                        })
                    except OSError:
                        pass
        
        # Sort by mtime descending and take top 10
        all_md_files.sort(key=lambda x: x["mtime"], reverse=True)
        top_10 = all_md_files[:10]
        
        return {"files": top_10}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/rename")
async def rename_file(item: RenameItem, request: Request):
    try:
        active_vault = get_active_vault(request)
        old_full_path = os.path.join(active_vault, item.old_path)
        new_full_path = os.path.join(active_vault, item.new_path)
        
        if not os.path.exists(old_full_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
        os.rename(old_full_path, new_full_path)
        return {"success": True, "new_path": item.new_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/file")
async def get_file(path: str, request: Request):
    """Read file content"""
    try:
        active_vault = get_active_vault(request)
        full_path = os.path.join(active_vault, path)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        mtime = os.path.getmtime(full_path)
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {"content": content, "mtime": mtime}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/file")
async def delete_file(path: str, request: Request):
    try:
        active_vault = get_active_vault(request)
        full_path = os.path.join(active_vault, path)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateFileRequest(BaseModel):
    path: str
    content: str = ""

@app.post("/api/files")
async def create_file(req: CreateFileRequest, request: Request):
    """Create a new file"""
    try:
        active_vault = get_active_vault(request)
        full_path = os.path.join(active_vault, req.path)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Check if file already exists
        if os.path.exists(full_path):
            raise HTTPException(status_code=409, detail="File already exists")
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(req.content)

        return {"status": "success", "path": req.path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SaveFileRequest(BaseModel):
    path: str
    content: str

@app.put("/api/file")
async def save_file(req: SaveFileRequest, request: Request):
    """Write file content"""
    try:
        active_vault = get_active_vault(request)
        full_path = os.path.join(active_vault, req.path)

        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(req.content)
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vault-name")
async def get_vault_name(request: Request):
    """Get vault folder name"""
    try:
        active_vault = get_active_vault(request)
        vault_name = os.path.basename(os.path.normpath(active_vault))
        # Try to get a more descriptive name from .metadata if available
        metadata_path = os.path.join(active_vault, '.metadata', 'vault-config.md')
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