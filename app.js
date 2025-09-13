// Shared Notes Frontend Application
class SharedNotesApp {
    constructor() {
        this.apiBaseUrl = CONFIG.API_BASE_URL;
        this.currentUser = null;
        this.accessToken = localStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
        this.refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_STORAGE_KEY);
        this.currentNoteId = null;
        this.publicNotes = []; // Store loaded public notes
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.showHome();
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

        // Share form
        document.getElementById('shareForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.shareNote();
        });
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
                
                await this.getCurrentUser();
                this.showAlert('Accesso effettuato con successo!', 'success');
                this.showMyNotes();
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
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
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
            this.showHome();
            this.showAlert('Disconnesso con successo', 'info');
        }
    }

    async getCurrentUser() {
        if (!this.accessToken) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                this.updateAuthUI();
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.getCurrentUser();
            }
        } catch (error) {
            console.error('Error getting current user:', error);
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

    checkAuthStatus() {
        if (this.accessToken) {
            this.getCurrentUser();
        } else {
            this.updateAuthUI();
        }
    }

    updateAuthUI() {
        const authNav = document.getElementById('authNav');
        
        if (this.currentUser) {
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
            
            // Hide login/register buttons on home page
            document.getElementById('loginBtn').style.display = 'none';
            document.getElementById('registerBtn').style.display = 'none';
        } else {
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
            
            // Show login/register buttons on home page
            document.getElementById('loginBtn').style.display = 'inline-block';
            document.getElementById('registerBtn').style.display = 'inline-block';
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

    showHome() {
        this.showPage('homePage');
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
        if (!this.currentUser) {
            this.showLogin();
            return;
        }
        
        this.showPage('myNotesPage');
        await this.loadNotes();
    }

    async showPublicNotes() {
        this.showPage('publicNotesPage');
        await this.loadPublicNotes();
    }

    // Notes Methods
    async loadNotes() {
        if (!this.accessToken) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/notes/`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const notes = await response.json();
                this.displayNotes(notes, 'notesList', false);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.loadNotes();
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento delle note', 'danger');
        }
    }

    async loadPublicNotes() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/notes/public`);

            if (response.ok) {
                const notes = await response.json();
                this.publicNotes = notes; // Store public notes for later use
                this.displayNotes(notes, 'publicNotesList', true);
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento delle note pubbliche', 'danger');
        }
    }

    displayNotes(notes, containerId, isPublic = false) {
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
                        ${note.is_public ? '<span class="public-badge">Pubblica</span>' : ''}
                    </div>
                    <div class="card-body">
                        <div class="note-content">
                            ${note.content ? this.convertUrlsToLinks(note.content) : '<em>Nessun contenuto</em>'}
                        </div>
                        <div class="note-meta">
                            <small>
                                <i class="bi bi-calendar"></i> ${new Date(note.created_at).toLocaleDateString()}
                                ${note.owner_id === this.currentUser?.id ? '<span class="badge bg-primary ms-2">Proprietario</span>' : ''}
                            </small>
                        </div>
                        <div class="note-actions">
                            <button class="btn btn-sm btn-outline-primary" onclick="app.viewNote(${note.id}, ${isPublic})">
                                <i class="bi bi-eye"></i> Visualizza
                            </button>
                            ${note.owner_id === this.currentUser?.id ? `
                                <button class="btn btn-sm btn-outline-secondary" onclick="app.editNote(${note.id})">
                                    <i class="bi bi-pencil"></i> Modifica
                                </button>
                                <button class="btn btn-sm btn-outline-info" onclick="app.showShareModal(${note.id})">
                                    <i class="bi bi-share"></i> Condividi
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
        document.getElementById('noteModalTitle').textContent = 'Crea Nota';
        document.getElementById('noteForm').reset();
        document.getElementById('noteIsPublic').checked = CONFIG.DEFAULT_NOTE_VISIBILITY;
        
        const modal = new bootstrap.Modal(document.getElementById('noteModal'));
        modal.show();
    }

    async editNote(noteId) {
        if (!this.accessToken) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const note = await response.json();
                this.currentNoteId = noteId;
                
                document.getElementById('noteModalTitle').textContent = 'Modifica Nota';
                document.getElementById('noteTitle').value = note.title;
                document.getElementById('noteContent').value = note.content || '';
                document.getElementById('noteIsPublic').checked = note.is_public;
                
                const modal = new bootstrap.Modal(document.getElementById('noteModal'));
                modal.show();
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.editNote(noteId);
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento della nota', 'danger');
        }
    }

    async saveNote() {
        if (!this.accessToken) return;

        const title = document.getElementById('noteTitle').value;
        const content = document.getElementById('noteContent').value;
        const isPublic = document.getElementById('noteIsPublic').checked;

        const noteData = {
            title: title,
            content: content,
            is_public: isPublic
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
                this.showAlert(
                    this.currentNoteId ? 'Nota aggiornata con successo!' : 'Nota creata con successo!', 
                    'success'
                );
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('noteModal'));
                modal.hide();
                
                await this.loadNotes();
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
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                this.showAlert('Nota eliminata con successo!', 'success');
                await this.loadNotes();
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

    async viewNote(noteId, isPublic = false) {
        // For public notes, we don't need authentication
        // For private notes, we need authentication
        if (!isPublic && !this.accessToken) {
            this.showAlert('Devi effettuare l\'accesso per visualizzare questa nota', 'warning');
            return;
        }

        // For public notes, use cached data instead of API call
        if (isPublic) {
            const note = this.publicNotes.find(n => n.id === parseInt(noteId));
            if (note) {
                this.showNoteModal(note);
                return;
            } else {
                this.showAlert('Nota non trovata', 'danger');
                return;
            }
        }

        try {
            const headers = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/notes/${noteId}`, {
                headers: headers
            });

            if (response.ok) {
                const note = await response.json();
                this.showNoteModal(note);
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.viewNote(noteId, isPublic);
            }
        } catch (error) {
            this.showAlert('Errore nel caricamento della nota', 'danger');
        }
    }

    showNoteModal(note) {
        // Create a modal to display the note
        const modalHtml = `
            <div class="modal fade" id="viewNoteModal" tabindex="-1">
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
                                </small>
                            </div>
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
        const modal = new bootstrap.Modal(document.getElementById('viewNoteModal'));
        modal.show();
        
        // Clean up modal when hidden
        document.getElementById('viewNoteModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    showShareModal(noteId) {
        this.currentNoteId = noteId;
        document.getElementById('shareForm').reset();
        document.getElementById('sharePermission').value = CONFIG.DEFAULT_SHARE_PERMISSION;
        
        const modal = new bootstrap.Modal(document.getElementById('shareModal'));
        modal.show();
    }

    async shareNote() {
        if (!this.accessToken) return;

        const userId = document.getElementById('shareUserId').value;
        const permission = document.getElementById('sharePermission').value;

        try {
            const response = await fetch(`${this.apiBaseUrl}/notes/${this.currentNoteId}/share?user_id=${userId}&permission=${permission}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                this.showAlert('Nota condivisa con successo!', 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('shareModal'));
                modal.hide();
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.shareNote();
            } else {
                const error = await response.json();
                this.showAlert(error.detail || 'Errore nella condivisione della nota', 'danger');
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
                            <td><strong>Email:</strong></td>
                            <td>${this.escapeHtml(this.currentUser.email)}</td>
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
        
        const modal = new bootstrap.Modal(document.getElementById('profileModal'));
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
function showHome() {
    app.showHome();
}

function showLogin() {
    app.showLogin();
}

function showRegister() {
    app.showRegister();
}

function showMyNotes() {
    app.showMyNotes();
}

function showPublicNotes() {
    app.showPublicNotes();
}

function showCreateNote() {
    app.showCreateNote();
}

function saveNote() {
    app.saveNote();
}

function shareNote() {
    app.shareNote();
}

// Initialize the application
const app = new SharedNotesApp();
