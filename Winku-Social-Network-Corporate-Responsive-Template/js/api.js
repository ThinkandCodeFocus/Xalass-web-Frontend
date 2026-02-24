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
     * Extrait un tableau depuis une réponse API avec différents formats possibles
     */
    extractArray(response, keys = []) {
        if (Array.isArray(response)) return response;
        if (!response || typeof response !== 'object') return [];

        for (const key of keys) {
            if (Array.isArray(response[key])) {
                return response[key];
            }
        }

        return [];
    }

    /**
     * Extrait un objet depuis une réponse API avec différents formats possibles
     */
    extractObject(response, keys = []) {
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            for (const key of keys) {
                if (response[key] && typeof response[key] === 'object') {
                    return response[key];
                }
            }
            return response;
        }
        return null;
    }

    /**
     * Récupère l'anon_uuid depuis la session
     */
    getAnonUuid() {
        const session = JSON.parse(localStorage.getItem('xalass_session') || '{}');
        return session.anon_uuid || null;
    }

    getSession() {
        return JSON.parse(localStorage.getItem('xalass_session') || '{}');
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
        const body = { code_name: (codeName || '').trim() };
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

        return this.extractObject(response, ['user', 'data']) || response;
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

        return this.extractObject(response, ['post', 'data']) || response;
    }

    /**
     * Récupère tous les posts
     */
    async getAllPosts() {
        const response = await this.request('/all/posts', {
            method: 'POST',
            body: JSON.stringify({})
        });

        return this.extractArray(response, ['posts', 'data', 'items']);
    }

    /**
     * Récupère un post par son ID
     */
    async getPostById(postId) {
        const response = await this.request(`/posts/${postId}`, {
            method: 'GET'
        });

        return this.extractObject(response, ['post', 'data']) || response;
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

        return this.extractArray(response, ['posts', 'data', 'items']);
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

        return this.extractArray(response, ['posts', 'data', 'items', 'post_id']);
    }

    /**
     * Recherche de posts par texte et optionnellement par catégorie
     */
    async searchPosts(query, category = null) {
        const body = {};
        // Ne pas envoyer query vide pour éviter les rejets de validation backend
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

        return this.extractArray(response, ['posts', 'data', 'items']);
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
                status,
                reset_reactions: true,
                clear_likes_on_edit: true
            })
        });

        return this.extractObject(response, ['post', 'data']) || response;
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

    /**
     * Supprime un post en supprimant d'abord ses commentaires/réponses
     * (workaround côté frontend pour éviter les erreurs FK SQL)
     */
    async deletePostCascade(postId) {
        const comments = await this.getCommentsByPost(postId);

        // Supprimer d'abord les réponses, puis les commentaires parents
        const idsToDelete = [];
        comments.forEach(comment => {
            const replies = Array.isArray(comment.replies) ? comment.replies : [];
            replies.forEach(reply => {
                const replyId = reply.comment_id || reply.id;
                if (replyId) idsToDelete.push(replyId);
            });
            const commentId = comment.comment_id || comment.id;
            if (commentId) idsToDelete.push(commentId);
        });

        for (const commentId of idsToDelete) {
            await this.deleteComment(commentId);
        }

        return this.deletePost(postId);
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

        return this.extractObject(response, ['comment', 'post', 'data']) || response;
    }

    /**
     * Récupère les commentaires d'un post
     */
    async getCommentsByPost(postId) {
        const response = await this.request(`/posts/${postId}/comments`, {
            method: 'GET'
        });

        return this.extractArray(response, ['comments', 'data', 'items']);
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
    async reportPost(postId, reason = null) {
        const session = this.getSession();
        const body = {};
        if (session && session.user_id) {
            body.author_internal_id = session.user_id;
            body.user_id = session.user_id;
        }
        if (reason) {
            body.reason = reason;
        }

        const response = await this.request(`/posts/${postId}/report`, {
            method: 'POST',
            body: JSON.stringify(body)
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

        return this.extractArray(response, ['notifications', 'data', 'items']);
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

        return this.extractArray(response, ['avatars', 'data', 'items']);
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

