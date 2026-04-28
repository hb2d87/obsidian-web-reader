// Obsidian Web Reader Frontend App
class ObsidianReader {
    constructor() {
        this.currentFile = null;
        this.isDirty = false;
        this.isMobile = window.innerWidth < 768;
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupResize();
        await this.loadVaultName();
        await this.loadFileTree();
        this.setupAutoSave();
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 768;
            if (this.isMobile) {
                this.closeSidebar();
            }
        });
    }

    bindEvents() {
        // Sidebar toggle (header button)
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            if (this.isMobile) {
                this.openSidebar();
            } else {
                this.toggleSidebar();
            }
        });

        // Mobile sidebar close button
        document.getElementById('sidebar-close').addEventListener('click', () => {
            this.closeSidebar();
        });

        // Mobile overlay click to close
        document.getElementById('sidebar-overlay').addEventListener('click', () => {
            this.closeSidebar();
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

    setupResize() {
        const sidebar = document.getElementById('sidebar');
        const resizer = document.getElementById('sidebar-resizer');
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const startResize = (e) => {
            if (this.isMobile) return;
            isResizing = true;
            resizer.classList.add('active');
            startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            startWidth = sidebar.offsetWidth;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        };

        const doResize = (e) => {
            if (!isResizing) return;
            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const delta = clientX - startX;
            const containerWidth = sidebar.parentElement.offsetWidth;
            let newWidth = startWidth + delta;
            
            // Apply min/max constraints
            const minWidth = containerWidth * 0.15;
            const maxWidth = containerWidth * 0.50;
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            
            sidebar.style.width = `${newWidth}px`;
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            resizer.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        // Mouse events
        resizer.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

        // Touch events
        resizer.addEventListener('touchstart', startResize, { passive: true });
        document.addEventListener('touchmove', doResize, { passive: false });
        document.addEventListener('touchend', stopResize);
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
                    <span class="folder-icon">&#9654;</span>
                    <span class="folder-name">${file.name}</span>
                `;
                
                // Click on the entire folder item toggles expand/collapse
                fileElement.addEventListener('click', (e) => {
                    // Only toggle if clicking on the folder item itself or its children (not child files)
                    const isFolderChild = e.target.closest('.folder-children');
                    if (!isFolderChild) {
                        this.toggleFolder(fileElement);
                    }
                });
            } else {
                fileElement.innerHTML = `
                    <span class="file-icon">&#9472;</span>
                    <span class="file-name">${file.name}</span>
                `;
                
                fileElement.addEventListener('click', () => {
                    this.loadFile(file.path);
                    // Close sidebar on mobile after selecting a file
                    if (this.isMobile) {
                        this.closeSidebar();
                    }
                });
            }

            container.appendChild(fileElement);

            if (file.is_dir && file.children && file.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
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
            if (children.classList.contains('hidden')) {
                icon.innerHTML = '&#9654;'; // ▶ collapsed
            } else {
                icon.innerHTML = '&#9660;'; // ▼ expanded
            }
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
                        const icon = parent.querySelector('.folder-icon');
                        if (icon) icon.innerHTML = '&#9660;'; // ▼ expanded
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
            this.updateTerminalStatus(path);
            
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
            saveStatus.textContent = '[modified]';
            saveStatus.style.color = 'var(--accent-amber)';
        } else {
            saveStatus.textContent = '[saved]';
            saveStatus.style.color = 'var(--accent-green)';
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

    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
    }

    updateStatus(text, success = false) {
        const statusElement = document.getElementById('status-text');
        statusElement.textContent = text;
        statusElement.classList.remove('terminal-path');
        
        if (success) {
            statusElement.style.color = 'var(--accent-green)';
            setTimeout(() => {
                statusElement.style.color = 'var(--text-secondary)';
            }, 2000);
        }
    }

    updateTerminalStatus(path) {
        const statusElement = document.getElementById('status-text');
        if (path) {
            statusElement.textContent = `cat ${path}`;
            statusElement.classList.add('terminal-path');
        } else {
            statusElement.textContent = 'Ready';
            statusElement.classList.remove('terminal-path');
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
