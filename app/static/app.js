// Obsidian Web Reader Frontend App
class ObsidianReader {
    constructor() {
        this.currentFile = null;
        this.isDirty = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadVaultName();
        await this.loadFileTree();
        this.setupAutoSave();
    }

    bindEvents() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Search input
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterFiles(e.target.value);
        });

        // Editor events
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.setDirty(true);
        });

        editor.addEventListener('blur', () => {
            this.saveFile();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S or Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            }
        });
    }

    async loadVaultName() {
        try {
            const response = await fetch('/api/vault-name');
            const data = await response.json();
            document.getElementById('vault-name').textContent = data.name;
        } catch (error) {
            console.error('Failed to load vault name:', error);
        }
    }

    async loadFileTree() {
        try {
            const response = await fetch('/api/files');
            const data = await response.json();
            this.renderFileTree(data.files);
        } catch (error) {
            console.error('Failed to load file tree:', error);
            this.updateStatus('Failed to load file tree');
        }
    }

    renderFileTree(files, container = null, level = 0) {
        if (!container) {
            container = document.getElementById('file-tree');
            container.innerHTML = '';
        }

        files.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = `file-item ${file.is_dir ? 'folder' : 'file'}`;
            fileElement.dataset.path = file.path;

            if (file.is_dir) {
                fileElement.innerHTML = `
                    <span class="folder-icon">📁</span>
                    <span>${file.name}</span>
                `;
                
                fileElement.addEventListener('click', (e) => {
                    if (e.target !== fileElement) return;
                    this.toggleFolder(fileElement);
                });
            } else {
                fileElement.innerHTML = `
                    <span>${file.name}</span>
                `;
                
                fileElement.addEventListener('click', () => {
                    this.loadFile(file.path);
                });
            }

            container.appendChild(fileElement);

            if (file.is_dir && file.children && file.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                childrenContainer.style.marginLeft = '16px';
                container.appendChild(childrenContainer);
                this.renderFileTree(file.children, childrenContainer, level + 1);
            }
        });
    }

    toggleFolder(folderElement) {
        const children = folderElement.nextElementSibling;
        if (children && children.classList.contains('folder-children')) {
            children.classList.toggle('hidden');
            const icon = folderElement.querySelector('.folder-icon');
            icon.textContent = children.classList.contains('hidden') ? '📁' : '📂';
        }
    }

    filterFiles(query) {
        const fileItems = document.querySelectorAll('.file-item');
        query = query.toLowerCase();

        fileItems.forEach(item => {
            const fileName = item.textContent.toLowerCase();
            if (query === '' || fileName.includes(query)) {
                item.style.display = '';
                // Show parent folders
                let parent = item.parentElement;
                while (parent && parent.classList.contains('folder-children')) {
                    parent.classList.remove('hidden');
                    parent = parent.parentElement;
                    if (parent && parent.classList.contains('file-item')) {
                        parent.querySelector('.folder-icon').textContent = '📂';
                    }
                }
            } else {
                item.style.display = 'none';
            }
        });
    }

    async loadFile(path) {
        // Save current file if dirty
        if (this.isDirty) {
            await this.saveFile();
        }

        try {
            this.updateStatus(`Loading ${path}...`);
            const response = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
            const data = await response.json();
            
            document.getElementById('editor').value = data.content;
            this.currentFile = path;
            this.setDirty(false);
            
            // Update UI
            document.getElementById('current-file').textContent = path;
            this.updateStatus(`Loaded ${path}`);
            
            // Highlight selected file
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected');
            });
            const fileElement = document.querySelector(`.file-item[data-path="${path}"]`);
            if (fileElement) {
                fileElement.classList.add('selected');
            }
        } catch (error) {
            console.error('Failed to load file:', error);
            this.updateStatus(`Failed to load ${path}`);
        }
    }

    async saveFile() {
        if (!this.currentFile || !this.isDirty) return;

        try {
            this.updateStatus(`Saving ${this.currentFile}...`);
            const content = document.getElementById('editor').value;
            
            const response = await fetch(`/api/file?path=${encodeURIComponent(this.currentFile)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(content)
            });
            
            if (response.ok) {
                this.setDirty(false);
                this.updateStatus(`Saved ${this.currentFile}`, true);
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            console.error('Failed to save file:', error);
            this.updateStatus(`Failed to save ${this.currentFile}`);
        }
    }

    setDirty(dirty) {
        this.isDirty = dirty;
        const saveStatus = document.getElementById('save-status');
        if (dirty) {
            saveStatus.textContent = '●';
        } else {
            saveStatus.textContent = '✓ Saved';
            setTimeout(() => {
                if (!this.isDirty) {
                    saveStatus.textContent = '';
                }
            }, 2000);
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    updateStatus(text, success = false) {
        const statusElement = document.getElementById('status-text');
        statusElement.textContent = text;
        
        if (success) {
            statusElement.style.color = 'var(--accent-green)';
            setTimeout(() => {
                statusElement.style.color = 'var(--text-secondary)';
            }, 2000);
        }
    }

    setupAutoSave() {
        // Auto-save every 30 seconds if dirty
        setInterval(() => {
            if (this.isDirty) {
                this.saveFile();
            }
        }, 30000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.obsidianReader = new ObsidianReader();
});