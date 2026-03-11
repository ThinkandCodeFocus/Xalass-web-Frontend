/* =====================================
   Xalass - Service API
   Requetes HTTP vers le backend Laravel
   ===================================== */

class XalassAPI {
    constructor() {
        this.baseURL = (API_CONFIG.BASE_URL || '').replace(/\/+$/, '');
        this.headers = { ...API_CONFIG.DEFAULT_HEADERS };
        this.sessionStorageKey = API_CONFIG.SESSION_STORAGE_KEY || 'xalass_session';
        this.timeoutMs = API_CONFIG.REQUEST_TIMEOUT_MS || 45000;
    }

    getSession() {
        try {
            return JSON.parse(localStorage.getItem(this.sessionStorageKey) || '{}');
        } catch (error) {
            return {};
        }
    }

    normalizeEndpoint(endpoint) {
        if (!endpoint) return '';
        return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    }

    buildUrl(endpoint) {
        return `${this.baseURL}${this.normalizeEndpoint(endpoint)}`;
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

    getAnonUuid() {
        const session = this.getSession();
        return session.anon_uuid || null;
    }

    getSessionHash() {
        const session = this.getSession();
        return session.session_hash || null;
    }

    getHeaders(method = 'GET', body = null, extraHeaders = {}) {
        const headers = {
            ...this.headers,
            ...extraHeaders
        };
        
        const anonUuid = this.getAnonUuid();
        if (anonUuid) {
            headers['X-Anon-ID'] = anonUuid;
        }

        const sessionHash = this.getSessionHash();
        if (sessionHash) {
            headers['X-Session-Hash'] = sessionHash;
        }

        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        const hasBody = body !== undefined && body !== null;

        if (method === 'GET' || method === 'HEAD' || !hasBody || isFormData) {
            delete headers['Content-Type'];
        }

        return headers;
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return {};
        }

        const text = await response.text();
        if (!text) return {};

        try {
            return JSON.parse(text);
        } catch (error) {
            return { message: text };
        }
    }

    extractErrorMessage(data, response) {
        if (data && typeof data === 'object') {
            if (typeof data.error === 'string' && data.error.trim()) return data.error;
            if (typeof data.message === 'string' && data.message.trim()) return data.message;
            if (data.errors && typeof data.errors === 'object') {
                const firstField = Object.keys(data.errors)[0];
                if (firstField && Array.isArray(data.errors[firstField]) && data.errors[firstField][0]) {
                    return data.errors[firstField][0];
                }
            }
        }
        return `Erreur ${response.status}: ${response.statusText}`;
    }

    async request(endpoint, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const url = this.buildUrl(endpoint);
        const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : this.timeoutMs;

        const headers = this.getHeaders(method, options.body, options.headers || {});
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const config = {
            ...options,
            method,
            headers,
            signal: controller.signal
        };
        delete config.timeoutMs;

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);
            const data = await this.parseResponse(response);
            if (!response.ok) throw new Error(this.extractErrorMessage(data, response));
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Le serveur met trop de temps à répondre (${Math.round(timeoutMs / 1000)}s). Render peut être en phase de réveil.`);
            }
            if (error.name === 'TypeError') {
                throw new Error(`Connexion impossible au backend. Vérifiez CORS et le déploiement.`);
            }
            throw error;
        }
    }

    // ========== UTILISATEURS ANONYMES ==========

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

    async loginAnonymousUser(codeName, password = null) {
        const body = { code_name: (codeName || '').trim() };
        if (password) body.password = password;
        const response = await this.request('/login/anoUser', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        return response.user;
    }

    async updateProfile(userId, data) {
        const response = await this.request('/update/profile', {
            method: 'POST',
            body: JSON.stringify({ ...data, author_internal_id: userId })
        });
        return this.extractObject(response, ['user', 'data']) || response;
    }

    // ========== POSTS ==========

    async createPost(title, content, category, status = 'FINISH') {
        const response = await this.request('/create/posts', {
            method: 'POST',
            body: JSON.stringify({ title, content, category, status })
        });
        return this.extractObject(response, ['post', 'data']) || response;
    }

    async getAllPosts() {
        const response = await this.request('/all/posts', {
            method: 'POST',
            body: JSON.stringify({})
        });
        return this.extractArray(response, ['posts', 'data', 'items']);
    }

    async getPostById(postId) {
        const response = await this.request(`/posts/${postId}`, { method: 'GET' });
        return this.extractObject(response, ['post', 'data']) || response;
    }

    async getPostsByAuthor(authorId) {
        const response = await this.request('/author/posts', {
            method: 'POST',
            body: JSON.stringify({ author_internal_id: authorId })
        });
        return this.extractArray(response, ['posts', 'data', 'items']);
    }

    async getPostsByCategory(category) {
        const response = await this.request('/category/posts', {
            method: 'POST',
            body: JSON.stringify({ category })
        });
        return this.extractArray(response, ['posts', 'data', 'items']);
    }

    async searchPosts(query, category = null) {
        const body = {};
        if (query) body.query = query;
        if (category && category !== 'all') body.category = category;

        const response = await this.request('/search/posts', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        return this.extractArray(response, ['posts', 'data', 'items']);
    }

    async updatePost(postId, title, content, category, status) {
        const response = await this.request('/update/posts', {
            method: 'POST',
            body: JSON.stringify({
                post_id: postId,
                title, content, category, status,
                reset_reactions: true,
                clear_likes_on_edit: true
            })
        });
        return this.extractObject(response, ['post', 'data']) || response;
    }

    async deletePost(postId) {
        return await this.request('/delete/posts', {
            method: 'POST',
            body: JSON.stringify({ post_id: postId })
        });
    }

    async deletePostCascade(postId) {
        const comments = await this.getCommentsByPost(postId);
        const idsToDelete = [];
        comments.forEach(comment => {
            const replies = Array.isArray(comment.replies) ? comment.replies : [];
            replies.forEach(reply => idsToDelete.push(reply.comment_id || reply.id));
            idsToDelete.push(comment.comment_id || comment.id);
        });

        for (const commentId of idsToDelete) {
            await this.deleteComment(commentId);
        }
        return this.deletePost(postId);
    }

    // ========== RÉACTIONS & COMMENTAIRES ==========

    async togglePostReaction(postId) {
        return await this.request(`/posts/${postId}/reactions`, {
            method: 'POST',
            body: JSON.stringify({ type: 'like' })
        });
    }

    async toggleCommentReaction(commentId) {
        return await this.request(`/comments/${commentId}/reactions`, {
            method: 'POST',
            body: JSON.stringify({ type: 'like' })
        });
    }

    async createComment(postId, content, parentId = null) {
        const body = { post_id: postId, content };
        if (parentId) body.parent_id = parentId;
        const response = await this.request('/create/comment', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        return this.extractObject(response, ['comment', 'post', 'data']) || response;
    }

    async getCommentsByPost(postId) {
        const response = await this.request(`/posts/${postId}/comments`, { method: 'GET' });
        return this.extractArray(response, ['comments', 'data', 'items']);
    }

    async deleteComment(commentId) {
        return await this.request('/delete/comment', {
            method: 'POST',
            body: JSON.stringify({ comment_id: commentId })
        });
    }

    async reportPost(postId, reason = null) {
        const session = this.getSession();
        const body = {};
        if (session?.user_id) body.user_id = session.user_id;
        if (reason) body.reason = reason;

        return await this.request(`/posts/${postId}/report`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // ========== NOTIFICATIONS & SSE ==========

    async getNotifications() {
        const response = await this.request('/notifications', { method: 'GET' });
        return this.extractArray(response, ['notifications', 'data', 'items']);
    }

    async markNotificationAsRead(notificationId) {
        return await this.request(`/notifications/${notificationId}/read`, {
            method: 'PUT',
            body: JSON.stringify({})
        });
    }

    async markAllNotificationsAsRead() {
        return await this.request('/notifications/read-all', {
            method: 'PUT',
            body: JSON.stringify({})
        });
    }

    async deleteNotification(notificationId) {
        return await this.request(`/notifications/${notificationId}`, {
            method: 'DELETE'
        });
    }

    async getAvatars() {
        const response = await this.request('/media/avatars', { method: 'GET' });
        return this.extractArray(response, ['avatars', 'data', 'items']);
    }

    createEventSource(lastPostId = 0) {
        const params = new URLSearchParams({ last_post_id: String(lastPostId) });
        const anonUuid = this.getAnonUuid();
        if (anonUuid) params.set('anon_uuid', anonUuid);
        const sessionHash = this.getSessionHash();
        if (sessionHash) params.set('session_hash', sessionHash);

        return new EventSource(`${this.baseURL}/stream/posts?${params.toString()}`);
    }
}

const api = new XalassAPI();
