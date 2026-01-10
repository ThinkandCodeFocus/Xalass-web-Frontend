/* =====================================
   Xalass - Service API
   Gestion de toutes les requêtes HTTP vers le backend Laravel
   ===================================== */

class XalassAPI {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.headers = { ...API_CONFIG.DEFAULT_HEADERS };
    }

    /**
     * Récupère l'anon_uuid depuis la session
     */
    getAnonUuid() {
        const session = JSON.parse(localStorage.getItem('xalass_session') || '{}');
        return session.anon_uuid || null;
    }

    /**
     * Ajoute le header X-Anon-ID si l'utilisateur est connecté
     */
    getHeaders() {
        const headers = { ...this.headers };
        const anonUuid = this.getAnonUuid();
        if (anonUuid) {
            headers['X-Anon-ID'] = anonUuid;
        }
        return headers;
    }

    /**
     * Effectue une requête HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            
            // Gérer les réponses vides
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const text = await response.text();
                data = text ? JSON.parse(text) : {};
            } else {
                data = {};
            }

            if (!response.ok) {
                const errorMessage = data.error || data.message || `Erreur ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            console.error('API Error:', {
                endpoint,
                url,
                error: error.message
            });
            
            // Si c'est une erreur réseau
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Impossible de se connecter au serveur. Vérifiez que le backend est démarré sur ' + this.baseURL);
            }
            
            throw error;
        }
    }

    // ========== UTILISATEURS ANONYMES ==========

    /**
     * Crée un nouvel utilisateur anonyme
     */
    async createAnonymousUser(codeName, password = null) {
        const body = {};
        if (codeName) body.code_name = codeName;
        if (password) {
            body.password = password;
            body.password_confirmation = password;
        }

        const response = await this.request('/create/anoUser', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        return response.user;
    }

    /**
     * Connecte un utilisateur anonyme
     */
    async loginAnonymousUser(codeName, password = null) {
        const body = { code_name: codeName };
        if (password) body.password = password;

        const response = await this.request('/login/anoUser', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        return response.user;
    }

    /**
     * Met à jour le profil de l'utilisateur
     */
    async updateProfile(userId, data) {
        const response = await this.request('/update/profile', {
            method: 'POST',
            body: JSON.stringify({
                ...data,
                author_internal_id: userId
            })
        });

        return response.user;
    }

    // ========== POSTS ==========

    /**
     * Crée un nouveau post
     */
    async createPost(title, content, category, status = 'FINISH') {
        const response = await this.request('/create/posts', {
            method: 'POST',
            body: JSON.stringify({
                title,
                content,
                category,
                status
            })
        });

        return response.post;
    }

    /**
     * Récupère tous les posts
     */
    async getAllPosts() {
        const response = await this.request('/all/posts', {
            method: 'POST',
            body: JSON.stringify({})
        });

        return Array.isArray(response) ? response : [];
    }

    /**
     * Récupère un post par son ID
     */
    async getPostById(postId) {
        const response = await this.request(`/posts/${postId}`, {
            method: 'GET'
        });

        return response.post;
    }

    /**
     * Récupère les posts d'un auteur
     */
    async getPostsByAuthor(authorId) {
        const response = await this.request('/author/posts', {
            method: 'POST',
            body: JSON.stringify({
                author_internal_id: authorId
            })
        });

        return Array.isArray(response) ? response : [];
    }

    /**
     * Récupère les posts par catégorie
     */
    async getPostsByCategory(category) {
        const response = await this.request('/category/posts', {
            method: 'POST',
            body: JSON.stringify({
                category
            })
        });

        return response.post_id || [];
    }

    /**
     * Recherche de posts par texte et optionnellement par catégorie
     */
    async searchPosts(query, category = null) {
        const body = {};
        // Inclure query même si vide (null ou string vide) pour permettre recherche par catégorie seule
        if (query !== null && query !== undefined && query !== '') {
            body.query = query;
        }
        if (category && category !== 'all' && category !== null) {
            body.category = category;
        }

        const response = await this.request('/search/posts', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        return Array.isArray(response) ? response : [];
    }

    /**
     * Met à jour un post
     */
    async updatePost(postId, title, content, category, status) {
        const response = await this.request('/update/posts', {
            method: 'POST',
            body: JSON.stringify({
                post_id: postId,
                title,
                content,
                category,
                status
            })
        });

        return response.post;
    }

    /**
     * Supprime un post
     */
    async deletePost(postId) {
        const response = await this.request('/delete/posts', {
            method: 'POST',
            body: JSON.stringify({
                post_id: postId
            })
        });

        return response;
    }

    // ========== RÉACTIONS (LIKES) ==========

    /**
     * Toggle une réaction sur un post
     */
    async togglePostReaction(postId) {
        const response = await this.request(`/posts/${postId}/reactions`, {
            method: 'POST',
            body: JSON.stringify({
                type: 'like'
            })
        });

        return response;
    }

    /**
     * Toggle une réaction sur un commentaire
     */
    async toggleCommentReaction(commentId) {
        const response = await this.request(`/comments/${commentId}/reactions`, {
            method: 'POST',
            body: JSON.stringify({
                type: 'like'
            })
        });

        return response;
    }

    // ========== COMMENTAIRES ==========

    /**
     * Crée un commentaire sur un post
     */
    async createComment(postId, content, parentId = null) {
        const body = {
            post_id: postId,
            content
        };
        if (parentId) body.parent_id = parentId;

        const response = await this.request('/create/comment', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        return response.post; // Le backend retourne le commentaire dans 'post'
    }

    /**
     * Récupère les commentaires d'un post
     */
    async getCommentsByPost(postId) {
        const response = await this.request(`/posts/${postId}/comments`, {
            method: 'GET'
        });

        return response.comments || [];
    }

    /**
     * Supprime un commentaire
     */
    async deleteComment(commentId) {
        const response = await this.request('/delete/comment', {
            method: 'POST',
            body: JSON.stringify({
                comment_id: commentId
            })
        });

        return response;
    }

    // ========== SIGNALEMENTS ==========

    /**
     * Signale un post
     */
    async reportPost(postId) {
        const response = await this.request(`/posts/${postId}/report`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        return response;
    }

    // ========== NOTIFICATIONS ==========

    /**
     * Récupère les notifications de l'utilisateur
     */
    async getNotifications() {
        const response = await this.request('/notifications', {
            method: 'GET'
        });

        return Array.isArray(response) ? response : response.notifications || [];
    }

    /**
     * Marque une notification comme lue
     */
    async markNotificationAsRead(notificationId) {
        const response = await this.request(`/notifications/${notificationId}/read`, {
            method: 'PUT',
            body: JSON.stringify({})
        });

        return response;
    }

    /**
     * Marque toutes les notifications comme lues
     */
    async markAllNotificationsAsRead() {
        const response = await this.request('/notifications/read-all', {
            method: 'PUT',
            body: JSON.stringify({})
        });

        return response;
    }

    /**
     * Supprime une notification
     */
    async deleteNotification(notificationId) {
        const response = await this.request(`/notifications/${notificationId}`, {
            method: 'DELETE'
        });

        return response;
    }

    // ========== MÉDIAS ==========

    /**
     * Récupère la liste des avatars disponibles
     */
    async getAvatars() {
        const response = await this.request('/media/avatars', {
            method: 'GET'
        });

        return response.avatars || [];
    }

    // ========== SERVER-SENT EVENTS (SSE) ==========

    /**
     * Crée une connexion SSE pour les mises à jour en temps réel
     * Note: EventSource ne supporte pas les headers personnalisés
     * On passe l'anon_uuid en paramètre URL
     */
    createEventSource(lastPostId = 0) {
        const anonUuid = this.getAnonUuid();
        let url = `${this.baseURL}/stream/posts?last_post_id=${lastPostId}`;
        
        // EventSource ne supporte pas les headers, on passe l'UUID en paramètre
        // Le backend devra extraire depuis le header ou le paramètre
        if (anonUuid) {
            url += `&anon_uuid=${anonUuid}`;
        }

        const eventSource = new EventSource(url);
        return eventSource;
    }
}

// Instance globale de l'API
const api = new XalassAPI();

