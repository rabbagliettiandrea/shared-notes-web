// Shared Notes Frontend Application
class SharedNotesApp {
    constructor() {
        this.apiBaseUrl = CONFIG.API_BASE_URL;
        this.currentUser = null;
        this.accessToken = localStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
        this.refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_STORAGE_KEY);
        this.currentNoteId = null;
        this.availableTags = []; // Store available tags
        this.searchTimeouts = {}; // For debouncing different types of search
        this.isInitialLoad = true; // Flag to prevent search during initial load
        this.isLoading = {}; // Track loading states to prevent multiple simultaneous requests
        this.sharedUsers = []; // Store users to share the note with
        
        this.init().catch(error => {
            console.error('Error during app initialization:', error);
        });
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuthStatus();
        this.showMyNotes();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Note form
        document.getElementById('noteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNote();
        });


        // User search functionality
        const shareUsernameInput = document.getElementById('shareUsername');
        if (shareUsernameInput) {
            shareUsernameInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
        }

        // Search and filter event listeners
        this.setupSearchAndFilterListeners();
    }

    setupSearchAndFilterListeners() {
        // Search input for my notes
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.debounceSearch('myNotes', () => this.loadNotes(), 500);
            });
        }

        // Tag filter for my notes
        const tagFilter = document.getElementById('tagFilter');
        if (tagFilter) {
            tagFilter.addEventListener('change', () => {
                this.debounceSearch('myNotes', () => this.loadNotes(), 100);
            });
        }


    }

    debounceSearch(searchType, searchFunction, delay) {
        // Don't start new search if one is already in progress
        if (this.isLoading[searchType]) {
            return;
        }

        // Clear existing timeout for this search type
        if (this.searchTimeouts[searchType]) {
            clearTimeout(this.searchTimeouts[searchType]);
        }
        
        // Set new timeout
        this.searchTimeouts[searchType] = setTimeout(() => {
            // Check again before executing
            if (!this.isLoading[searchType]) {
                searchFunction();
            }
        }, delay);
    }

    // Authentication Methods
    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: username,
                    password: password
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                
                localStorage.setItem(CONFIG.TOKEN_STORAGE_KEY, this.accessToken);
                localStorage.setItem(CONFIG.REFRESH_TOKEN_STORAGE_KEY, this.refreshToken);
                
                // Get current user and wait for it to complete
                await this.getCurrentUser();
                
                // Only proceed if we successfully got the user info
                if (this.currentUser) {
                    this.showAlert('Accesso effettuato con successo!', 'success');
                    this.showMyNotes();
                } else {
                    this.showAlert('Errore nel recupero delle informazioni utente. Riprova.', 'danger');
                    console.error('Failed to get current user after login');
                }
            } else {
                const error = await response.json();
                this.showAlert(error.detail || 'Accesso fallito', 'danger');
            }
        } catch (error) {
            this.showAlert('Errore di rete. Riprova.', 'danger');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (response.ok) {
                this.showAlert('Registrazione completata con successo! Effettua l\'accesso.', 'success');
                this.showLogin();
                // Clear form
                document.getElementById('registerForm').reset();
            } else {
                const error = await response.json();
                this.showAlert(error.detail || 'Registrazione fallita', 'danger');
            }
        } catch (error) {
            this.showAlert('Errore di rete. Riprova.', 'danger');
        }
    }

    async logout() {
        try {
            if (this.accessToken) {
                await fetch(`${this.apiBaseUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.accessToken = null;
            this.refreshToken = null;
            this.currentUser = null;
            localStorage.removeItem(CONFIG.TOKEN_STORAGE_KEY);
            localStorage.removeItem(CONFIG.REFRESH_TOKEN_STORAGE_KEY);
            this.updateAuthUI();
            this.showMyNotes();
            this.showAlert('Disconnesso con successo', 'info');
        }
    }

    async getCurrentUser() {
        if (!this.accessToken) {
            this.currentUser = null;
            this.updateAuthUI();
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'X-Cache-Bust': Date.now().toString()
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                this.updateAuthUI();
            } else if (response.status === 401) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    return this.getCurrentUser();
                } else {
                    // Refresh failed, user is not authenticated
                    this.currentUser = null;
                    this.updateAuthUI();
                }
            } else {
                // Other error, assume not authenticated
                this.currentUser = null;
                this.updateAuthUI();
            }
        } catch (error) {
            // Network or other error, assume not authenticated
            console.error('Error getting current user:', error);
            this.currentUser = null;
            this.updateAuthUI();
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) return false;

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.access_token;
                localStorage.setItem(CONFIG.TOKEN_STORAGE_KEY, this.accessToken);
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            this.logout();
            return false;
        }
    }

    async checkAuthStatus() {
        await this.getCurrentUser();
    }

    updateAuthUI() {
        const authNav = document.getElementById('authNav');
        
        if (this.currentUser) {
            // User is authenticated - show user menu in navbar
            authNav.innerHTML = `
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                        <i class="bi bi-person-circle"></i> ${this.currentUser.username}
                    </a>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="app.showProfile()">
                            <i class="bi bi-person"></i> Profilo
                        </a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" onclick="app.logout()">
                            <i class="bi bi-box-arrow-right"></i> Esci
                        </a></li>
                    </ul>
                </li>
            `;
        } else {
            // User is not authenticated - show login/register in navbar
            authNav.innerHTML = `
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="app.showLogin()">
                        <i class="bi bi-box-arrow-in-right"></i> Accedi
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="app.showRegister()">
                        <i class="bi bi-person-plus"></i> Registrati
                    </a>
                </li>
            `;
        }
    }


    // Navigation Methods
    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.style.display = 'none';
        });
        
        // Show selected page
        document.getElementById(pageId).style.display = 'block';
    }


    showLogin() {
        this.showPage('loginPage');
        document.getElementById('loginForm').reset();
    }

    showRegister() {
        this.showPage('registerPage');
        document.getElementById('registerForm').reset();
    }

    async showMyNotes() {
        this.showPage('myNotesPage');
        
        if (!this.currentUser) {
            // Show anonymous content
            document.getElementById('anonymousContent').style.display = 'block';
            document.getElementById('authenticatedContent').style.display = 'none';
        } else {
            // Show authenticated content
            document.getElementById('anonymousContent').style.display = 'none';
            document.getElementById('authenticatedContent').style.display = 'block';
            
            this.isInitialLoad = true;
            await Promise.all([
                this.loadNotes(),
                this.loadAvailableTags()
            ]);
            this.isInitialLoad = false;
        }
    }



    // Notes Methods
    async loadNotes() {
        if (!this.accessToken) return;

        // Prevent multiple simultaneous requests
        if (this.isLoading['myNotes']) {
            return;
        }

        this.isLoading['myNotes'] = true;

        try {
            // Show loading state only if not initial load
            if (!this.isInitialLoad) {
                this.showLoadingState('notesList');
            }

            // Get search and filter parameters
            const searchInput = document.getElementById('searchInput');
            const tagFilter = document.getElementById('tagFilter');
            
            const search = searchInput ? searchInput.value.trim() : '';
            const selectedTags = tagFilter ? Array.from(tagFilter.selectedOptions)
                .map(option => option.value)
                .filter(value => value !== '') : [];

            // Build query parameters
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));
            // Add cache-busting parameter
            params.append('_t', Date.now());

            const url = `${this.apiBaseUrl}/notes/${params.toString() ? '?' + params.toString() : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                const notes = await response.json();
                this.displayNotes(notes, 'notesList');
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.loadNotes();
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento delle note', 'danger');
        } finally {
            this.isLoading['myNotes'] = false;
        }
    }



    async loadAvailableTags() {
        if (!this.accessToken) return;

        try {
            // Load tags from all accessible notes (owned + shared)
            const response = await fetch(`${this.apiBaseUrl}/notes?_t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                const notes = await response.json();
                // Extract unique tags from all notes
                const allTags = [...new Set(notes.flatMap(note => note.tags || []))];
                this.availableTags = allTags.sort();
                this.populateTagFilter('tagFilter', this.availableTags);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.loadAvailableTags();
            }
        } catch (error) {
            // Silent error handling
        }
    }



    populateTagFilter(filterId, tags) {
        const filter = document.getElementById(filterId);
        if (!filter) return;

        // Check if tags are already loaded (avoid unnecessary DOM updates)
        const currentOptions = Array.from(filter.options).slice(1).map(option => option.value);
        const newTags = tags.sort();
        
        if (currentOptions.length === newTags.length && 
            currentOptions.every((tag, index) => tag === newTags[index])) {
            return;
        }

        // Clear existing options except the first one
        filter.innerHTML = '<option value="">Tutti i tag</option>';
        
        // Add tag options
        newTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            filter.appendChild(option);
        });
    }

    clearFilters() {
        const searchInput = document.getElementById('searchInput');
        const tagFilter = document.getElementById('tagFilter');
        
        if (searchInput) searchInput.value = '';
        if (tagFilter) tagFilter.selectedIndex = 0;
        
        this.loadNotes();
    }



    showLoadingState(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Caricamento...</span>
                    </div>
                    <p class="mt-3 text-muted">Caricamento delle note...</p>
                </div>
            </div>
        `;
    }

    displayNotes(notes, containerId, isShared = false) {
        const container = document.getElementById(containerId);
        
        if (notes.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="bi bi-journal-x"></i>
                        <h3>Nessuna nota trovata</h3>
                        <p>Inizia creando la tua prima nota!</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = notes.map(note => `
            <div class="col-md-6 col-lg-4">
                <div class="card note-card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0 text-truncate">${this.escapeHtml(note.title)}</h6>
                    </div>
                    <div class="card-body">
                        <div class="note-content">
                            ${note.content ? this.convertUrlsToLinks(note.content) : '<em>Nessun contenuto</em>'}
                        </div>
                        ${note.tags && note.tags.length > 0 ? `
                        <div class="note-tags mb-2">
                            ${note.tags.map(tag => `<span class="badge bg-secondary me-1">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                        ` : ''}
                        <div class="note-meta">
                            <small>
                                <i class="bi bi-calendar"></i> ${new Date(note.created_at).toLocaleDateString()}
                                ${note.owner_id === this.currentUser?.id ? 
                                    '<span class="badge bg-primary ms-2">Le mie note</span>' : 
                                    `<span class="badge bg-success ms-2">Condivisa da ${this.escapeHtml(note.owner_username || 'Sconosciuto')}</span>`
                                }
                            </small>
                            ${note.owner_id === this.currentUser?.id && note.shared_with && note.shared_with.length > 0 ? `
                                <div class="mt-2">
                                    <small class="text-muted">
                                        <i class="bi bi-people"></i> Condivisa con: 
                                        ${note.shared_with.map(username => `
                                            <span class="badge bg-success me-1">
                                                ${this.escapeHtml(username)}
                                            </span>
                                        `).join('')}
                                    </small>
                                </div>
                            ` : ''}
                        </div>
                        <div class="note-actions">
                            <button class="btn btn-sm btn-outline-primary" onclick="app.viewNote(${note.id})">
                                <i class="bi bi-eye"></i> Visualizza
                            </button>
                            ${note.owner_id === this.currentUser?.id ? `
                                <button class="btn btn-sm btn-outline-secondary" onclick="app.editNote(${note.id})">
                                    <i class="bi bi-pencil"></i> Modifica
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="app.deleteNote(${note.id})">
                                    <i class="bi bi-trash"></i> Elimina
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showCreateNote() {
        this.currentNoteId = null;
        this.sharedUsers = [];
        document.getElementById('noteModalTitle').textContent = 'Crea Nota';
        document.getElementById('noteForm').reset();
        this.updateSharedUsersList();
        
        const modalElement = document.getElementById('noteModal');
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Use inert instead of aria-hidden for better accessibility
        modalElement.addEventListener('show.bs.modal', function() {
            this.removeAttribute('inert');
            this.removeAttribute('aria-hidden');
        });
        
        modalElement.addEventListener('shown.bs.modal', function() {
            this.removeAttribute('inert');
            this.removeAttribute('aria-hidden');
        });
        
        modalElement.addEventListener('hide.bs.modal', function() {
            this.setAttribute('inert', '');
        });
        
        modal.show();
    }

    async editNote(noteId) {
        if (!this.accessToken) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}?_t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                const note = await response.json();
                this.currentNoteId = noteId;
                
                document.getElementById('noteModalTitle').textContent = 'Modifica Nota';
                document.getElementById('noteTitle').value = note.title;
                document.getElementById('noteContent').value = note.content || '';
                document.getElementById('noteTags').value = note.tags ? note.tags.join(', ') : '';
                
                // Load existing shared users
                this.sharedUsers = [];
                if (note.shared_with && note.shared_with.length > 0) {
                    // Get user IDs for existing shared users
                    for (const username of note.shared_with) {
                        try {
                            const userResponse = await fetch(`${this.apiBaseUrl}/users/search?query=${encodeURIComponent(username)}`, {
                                headers: {
                                    'Authorization': `Bearer ${this.accessToken}`
                                }
                            });
                            if (userResponse.ok) {
                                const users = await userResponse.json();
                                const user = users.find(u => u.username === username);
                                if (user) {
                                    this.sharedUsers.push({ id: user.id, username: user.username });
                                }
                            }
                        } catch (error) {
                            console.error('Error loading user ID:', error);
                            // Fallback to just username
                            this.sharedUsers.push({ username });
                        }
                    }
                }
                this.updateSharedUsersList();
                
                const modalElement = document.getElementById('noteModal');
                const modal = new bootstrap.Modal(modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });
                
                // Use inert instead of aria-hidden for better accessibility
                modalElement.addEventListener('show.bs.modal', function() {
                    this.removeAttribute('inert');
                    this.removeAttribute('aria-hidden');
                });
                
                modalElement.addEventListener('shown.bs.modal', function() {
                    this.removeAttribute('inert');
                    this.removeAttribute('aria-hidden');
                });
                
                modalElement.addEventListener('hide.bs.modal', function() {
                    this.setAttribute('inert', '');
                });
                
                modal.show();
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.editNote(noteId);
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento della nota', 'danger');
        }
    }

    updateSharedUsersList() {
        const sharedWithList = document.getElementById('sharedWithList');
        if (!sharedWithList) return;

        if (this.sharedUsers.length === 0) {
            sharedWithList.innerHTML = '<div class="text-muted">Nessun utente selezionato</div>';
            return;
        }

        sharedWithList.innerHTML = this.sharedUsers.map(user => `
            <span class="badge bg-success me-1 d-inline-flex align-items-center">
                ${this.escapeHtml(user.username)}
                <button type="button" class="btn-close btn-close-white ms-1" 
                        onclick="app.removeSharedUser('${this.escapeHtml(user.username)}')" 
                        title="Rimuovi ${this.escapeHtml(user.username)}"
                        style="font-size: 0.6em;"></button>
            </span>
        `).join('');
    }

    addSharedUser(userId, username) {
        // Check if user is already in the list
        if (this.sharedUsers.some(user => user.username === username)) {
            this.showAlert('Questo utente è già stato aggiunto', 'warning');
            return;
        }

        this.sharedUsers.push({ id: userId, username });
        this.updateSharedUsersList();
        
        // Clear the search input
        document.getElementById('shareUsername').value = '';
        document.getElementById('shareUserId').value = '';
        document.getElementById('userSearchResults').style.display = 'none';
        document.getElementById('userSearchResults').innerHTML = '';
    }

    removeSharedUser(username) {
        this.sharedUsers = this.sharedUsers.filter(user => user.username !== username);
        this.updateSharedUsersList();
    }

    async updateNoteSharing(noteId) {
        if (!this.accessToken) return;

        try {
            // First, get current shared users to compare
            const currentResponse = await fetch(`${this.apiBaseUrl}/notes/${noteId}?_t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (!currentResponse.ok) return;

            const currentNote = await currentResponse.json();
            const currentSharedUsers = currentNote.shared_with || [];

            // Get user IDs for new shared users
            const newSharedUserIds = [];
            for (const user of this.sharedUsers) {
                if (!user.id) {
                    // Need to get user ID from username
                    const userResponse = await fetch(`${this.apiBaseUrl}/users/search?query=${encodeURIComponent(user.username)}`, {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        }
                    });
                    if (userResponse.ok) {
                        const users = await userResponse.json();
                        const foundUser = users.find(u => u.username === user.username);
                        if (foundUser) {
                            newSharedUserIds.push(foundUser.id);
                        }
                    }
                } else {
                    newSharedUserIds.push(user.id);
                }
            }

            // Remove users that are no longer in the shared list
            for (const username of currentSharedUsers) {
                if (!this.sharedUsers.some(user => user.username === username)) {
                    // Get user ID and remove sharing
                    const userResponse = await fetch(`${this.apiBaseUrl}/users/search?query=${encodeURIComponent(username)}`, {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        }
                    });
                    if (userResponse.ok) {
                        const users = await userResponse.json();
                        const user = users.find(u => u.username === username);
                        if (user) {
                            await fetch(`${this.apiBaseUrl}/notes/${noteId}/share/${user.id}?_t=${Date.now()}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${this.accessToken}`,
                                    'Cache-Control': 'no-cache',
                                    'Pragma': 'no-cache'
                                }
                            });
                        }
                    }
                }
            }

            // Add new shared users
            for (const userId of newSharedUserIds) {
                if (!currentSharedUsers.includes(this.sharedUsers.find(u => u.id === userId)?.username)) {
                    await fetch(`${this.apiBaseUrl}/notes/${noteId}/share?user_id=${userId}&_t=${Date.now()}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error updating note sharing:', error);
        }
    }

    async saveNote() {
        if (!this.accessToken) return;

        const title = document.getElementById('noteTitle').value;
        const content = document.getElementById('noteContent').value;
        const isPublic = false; // Public notes functionality removed
        const tagsInput = document.getElementById('noteTags').value;
        
        // Parse tags from comma-separated string
        const tags = tagsInput
            ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            : [];

        const noteData = {
            title: title,
            content: content,
            tags: tags
        };

        try {
            const url = this.currentNoteId 
                ? `${this.apiBaseUrl}/notes/${this.currentNoteId}`
                : `${this.apiBaseUrl}/notes/`;
            
            const method = this.currentNoteId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify(noteData)
            });

            if (response.ok) {
                const savedNote = await response.json();
                
                // Handle sharing for the saved note
                await this.updateNoteSharing(savedNote.id);
                
                this.showAlert(
                    this.currentNoteId ? 'Nota aggiornata con successo!' : 'Nota creata con successo!', 
                    'success'
                );
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('noteModal'));
                modal.hide();
                
                await Promise.all([
                    this.loadNotes(),
                    this.loadAvailableTags()
                ]);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.saveNote();
            } else {
                const error = await response.json();
                this.showAlert(error.detail || 'Errore nel salvataggio della nota', 'danger');
            }
        } catch (error) {
            this.showAlert('Errore di rete. Riprova.', 'danger');
        }
    }

    async deleteNote(noteId) {
        if (!this.accessToken || !confirm('Sei sicuro di voler eliminare questa nota?')) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}?_t=${Date.now()}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                this.showAlert('Nota eliminata con successo!', 'success');
                await Promise.all([
                    this.loadNotes(),
                    this.loadAvailableTags()
                ]);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.deleteNote(noteId);
            } else {
                const error = await response.json();
                this.showAlert(error.detail || 'Errore nell\'eliminazione della nota', 'danger');
            }
        } catch (error) {
            this.showAlert('Errore di rete. Riprova.', 'danger');
        }
    }

    async viewNote(noteId) {
        // For private notes, we need authentication
        if (!this.accessToken) {
            this.showAlert('Devi effettuare l\'accesso per visualizzare questa nota', 'warning');
            return;
        }


        try {
            const headers = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}?_t=${Date.now()}`, {
                headers: {
                    ...headers,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                const note = await response.json();
                this.showNoteModal(note);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.viewNote(noteId);
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento della nota', 'danger');
        }
    }

    showNoteModal(note) {
        // Create a modal to display the note
        const modalHtml = `
            <div class="modal fade" id="viewNoteModal" tabindex="-1" inert>
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${this.escapeHtml(note.title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <small class="text-muted">
                                    <i class="bi bi-calendar"></i> Creato: ${new Date(note.created_at).toLocaleString()}
                                    ${note.updated_at ? `<br><i class="bi bi-pencil"></i> Aggiornato: ${new Date(note.updated_at).toLocaleString()}` : ''}
                                    <br>
                                    ${note.owner_id === this.currentUser?.id ? 
                                        '<i class="bi bi-person-check"></i> <span class="badge bg-primary">Le mie note</span>' : 
                                        `<i class="bi bi-people"></i> <span class="badge bg-success">Condivisa da ${this.escapeHtml(note.owner_username || 'Sconosciuto')}</span>`
                                    }
                                    ${note.owner_id === this.currentUser?.id && note.shared_with && note.shared_with.length > 0 ? `
                                        <br><i class="bi bi-share"></i> Condivisa con: 
                                        ${note.shared_with.map(username => `
                                            <span class="badge bg-success me-1">
                                                ${this.escapeHtml(username)}
                                            </span>
                                        `).join('')}
                                    ` : ''}
                                </small>
                            </div>
                            ${note.tags && note.tags.length > 0 ? `
                            <div class="mb-3">
                                <strong>Tag:</strong>
                                <div class="mt-1">
                                    ${note.tags.map(tag => `<span class="badge bg-secondary me-1">${this.escapeHtml(tag)}</span>`).join('')}
                                </div>
                            </div>
                            ` : ''}
                            <div class="note-content-full">
                                ${note.content ? this.convertUrlsToLinks(note.content).replace(/\n/g, '<br>') : '<em>Nessun contenuto</em>'}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                            ${note.owner_id === this.currentUser?.id && this.currentUser ? `
                                <button type="button" class="btn btn-primary" onclick="app.editNote(${note.id}); bootstrap.Modal.getInstance(document.getElementById('viewNoteModal')).hide();">
                                    <i class="bi bi-pencil"></i> Modifica
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('viewNoteModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modalElement = document.getElementById('viewNoteModal');
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Use inert instead of aria-hidden for better accessibility
        modalElement.addEventListener('show.bs.modal', function() {
            this.removeAttribute('inert');
            this.removeAttribute('aria-hidden');
        });
        
        modalElement.addEventListener('shown.bs.modal', function() {
            this.removeAttribute('inert');
            this.removeAttribute('aria-hidden');
        });
        
        modalElement.addEventListener('hide.bs.modal', function() {
            this.setAttribute('inert', '');
        });
        
        modal.show();
        
        // Clean up modal when hidden
        document.getElementById('viewNoteModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }


    async searchUsers(query) {
        if (!query || query.length < 2) {
            document.getElementById('userSearchResults').style.display = 'none';
            document.getElementById('userSearchResults').innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/users/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const users = await response.json();
                this.displayUserSearchResults(users);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.searchUsers(query);
            }
        } catch (error) {
            // Silent error handling
        }
    }

    displayUserSearchResults(users) {
        const resultsContainer = document.getElementById('userSearchResults');
        
        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="text-muted">Nessun utente trovato</div>';
            resultsContainer.style.display = 'block';
            return;
        }

        const resultsHtml = users.map(user => `
            <div class="user-search-result ${!user.is_active ? 'disabled' : ''}" 
                 onclick="${user.is_active ? `app.selectUser(${user.id}, '${this.escapeHtml(user.username)}')` : ''}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${this.escapeHtml(user.username)}</strong>
                        ${!user.is_active ? '<span class="text-muted">(Inattivo)</span>' : ''}
                    </div>
                </div>
            </div>
        `).join('');

        resultsContainer.innerHTML = resultsHtml;
        resultsContainer.style.display = 'block';
    }

    selectUser(userId, username) {
        this.addSharedUser(userId, username);
    }


    async unshareNote(noteId, username) {
        if (!this.accessToken) return;

        // Confirm the action
        if (!confirm(`Sei sicuro di voler rimuovere la condivisione con ${username}?`)) {
            return;
        }

        try {
            // First, we need to get the user ID from the username
            const userResponse = await fetch(`${this.apiBaseUrl}/users/search?query=${encodeURIComponent(username)}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (!userResponse.ok) {
                this.showAlert('Errore nel recupero delle informazioni utente', 'danger');
                return;
            }

            const users = await userResponse.json();
            const user = users.find(u => u.username === username);

            if (!user) {
                this.showAlert('Utente non trovato', 'danger');
                return;
            }

            // Now unshare the note
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}/share/${user.id}?_t=${Date.now()}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                this.showAlert(`Condivisione rimossa con successo da ${username}!`, 'success');
                // Reload notes to show updated sharing information
                await this.loadNotes();
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.unshareNote(noteId, username);
            } else {
                const error = await response.json();
                this.showAlert(error.detail || 'Errore nella rimozione della condivisione', 'danger');
            }
        } catch (error) {
            this.showAlert('Errore di rete. Riprova.', 'danger');
        }
    }

    async showProfile() {
        if (!this.currentUser) return;

        const profileHtml = `
            <div class="row">
                <div class="col-md-4">
                    <div class="text-center">
                        <i class="bi bi-person-circle" style="font-size: 4rem; color: #6c757d;"></i>
                        <h4 class="mt-2">${this.escapeHtml(this.currentUser.username)}</h4>
                    </div>
                </div>
                <div class="col-md-8">
                    <table class="table table-borderless">
                        <tr>
                            <td><strong>Nome Utente:</strong></td>
                            <td>${this.escapeHtml(this.currentUser.username)}</td>
                        </tr>
                        <tr>
                            <td><strong>Stato:</strong></td>
                            <td>
                                <span class="badge ${this.currentUser.is_active ? 'bg-success' : 'bg-danger'}">
                                    ${this.currentUser.is_active ? 'Attivo' : 'Inattivo'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Membro dal:</strong></td>
                            <td>${new Date(this.currentUser.created_at).toLocaleDateString()}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('userProfileInfo').innerHTML = profileHtml;
        
        const modalElement = document.getElementById('profileModal');
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Use inert instead of aria-hidden for better accessibility
        modalElement.addEventListener('show.bs.modal', function() {
            this.removeAttribute('inert');
            this.removeAttribute('aria-hidden');
        });
        
        modalElement.addEventListener('shown.bs.modal', function() {
            this.removeAttribute('inert');
            this.removeAttribute('aria-hidden');
        });
        
        modalElement.addEventListener('hide.bs.modal', function() {
            this.setAttribute('inert', '');
        });
        
        modal.show();
    }

    // Utility Methods
    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        const alertId = 'alert-' + Date.now();
        
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" id="${alertId}" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-remove alert after configured time
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, CONFIG.AUTO_HIDE_ALERTS_AFTER);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // URL detection regex pattern
    urlRegex() {
        return /(https?:\/\/[^\s<>"'`]+)/gi;
    }

    // Validate URL for security
    isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            // Only allow http and https protocols
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch {
            return false;
        }
    }

    // Convert text with URLs to HTML with clickable links
    convertUrlsToLinks(text) {
        if (!text) return '';
        
        // First escape HTML to prevent XSS
        const escapedText = this.escapeHtml(text);
        
        // Replace URLs with clickable links
        return escapedText.replace(this.urlRegex(), (match) => {
            if (this.isValidUrl(match)) {
                return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="note-link">${match}</a>`;
            }
            return match;
        });
    }
}

// Global functions for onclick handlers
function showLogin() {
    app.showLogin();
}

function showRegister() {
    app.showRegister();
}

function showMyNotes() {
    app.showMyNotes();
}



function showCreateNote() {
    app.showCreateNote();
}

function saveNote() {
    app.saveNote();
}


function clearFilters() {
    app.clearFilters();
}


// Initialize the application
const app = new SharedNotesApp();
