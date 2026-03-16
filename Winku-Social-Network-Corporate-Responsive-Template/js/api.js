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
        this.followMapStorageKey = 'xalass_follow_map_v1';
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

    async createAnonymousUser(codeName, password = null, avatarSeed = null) {
        const body = {};
        if (codeName) body.code_name = codeName;
        if (password) {
            body.password = password;
            body.password_confirmation = password;
        }
        if (avatarSeed !== null && avatarSeed !== undefined) {
            body.avatar = avatarSeed;
            body.avatar_id = avatarSeed;
            body.avatar_seed = avatarSeed;
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

    // ========== ABONNEMENTS (LOCAL STORAGE) ==========

    getFollowerKey(session = null) {
        const s = session || this.getSession() || {};
        const key = s.user_id || s.id || s.anon_uuid || s.code_name;
        return key !== undefined && key !== null && String(key).trim() ? String(key) : null;
    }

    readFollowMap() {
        try {
            const raw = localStorage.getItem(this.followMapStorageKey);
            const parsed = raw ? JSON.parse(raw) : {};
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
            return parsed;
        } catch (e) {
            return {};
        }
    }

    writeFollowMap(map) {
        try {
            localStorage.setItem(this.followMapStorageKey, JSON.stringify(map || {}));
        } catch (e) {
            // Ignore (quota / disabled storage)
        }
    }

    normalizeAuthorId(authorId) {
        if (authorId === undefined || authorId === null) return null;
        const str = String(authorId).trim();
        return str ? str : null;
    }

    getFollowingLocal(session = null) {
        const followerKey = this.getFollowerKey(session);
        if (!followerKey) return [];

        const map = this.readFollowMap();
        const value = map[followerKey];
        if (!Array.isArray(value)) return [];

        // Support legacy formats (array of ids) + current (array of objects).
        return value
            .map(item => {
                if (item && typeof item === 'object') {
                    const id = this.normalizeAuthorId(item.author_id ?? item.user_id ?? item.id);
                    if (!id) return null;
                    return {
                        author_id: id,
                        code_name: item.code_name ?? item.pseudo ?? null,
                        avatar_seed: item.avatar_seed ?? item.avatar ?? item.avatar_id ?? null
                    };
                }
                const id = this.normalizeAuthorId(item);
                if (!id) return null;
                return { author_id: id, code_name: null, avatar_seed: null };
            })
            .filter(Boolean);
    }

    getFollowingIdsLocal(session = null) {
        return this.getFollowingLocal(session).map(t => String(t.author_id));
    }

    isFollowingLocal(authorId, session = null) {
        const id = this.normalizeAuthorId(authorId);
        if (!id) return false;
        const ids = this.getFollowingIdsLocal(session);
        return ids.includes(id);
    }

    followLocal(target, session = null) {
        const followerKey = this.getFollowerKey(session);
        if (!followerKey) return false;

        const targetId = this.normalizeAuthorId(
            target && typeof target === 'object' ? (target.author_id ?? target.user_id ?? target.id) : target
        );
        if (!targetId) return false;

        const s = session || this.getSession() || {};
        const selfId = this.normalizeAuthorId(s.user_id ?? s.id);
        if (selfId && selfId === targetId) return false;

        const map = this.readFollowMap();
        const list = Array.isArray(map[followerKey]) ? map[followerKey] : [];

        // If already following, no-op.
        const exists = list.some(item => {
            if (item && typeof item === 'object') {
                return this.normalizeAuthorId(item.author_id ?? item.user_id ?? item.id) === targetId;
            }
            return this.normalizeAuthorId(item) === targetId;
        });
        if (exists) return true;

        const normalizedTarget = target && typeof target === 'object'
            ? {
                author_id: targetId,
                code_name: target.code_name ?? target.pseudo ?? null,
                avatar_seed: target.avatar_seed ?? target.avatar ?? target.avatar_id ?? null
            }
            : { author_id: targetId, code_name: null, avatar_seed: null };

        map[followerKey] = [...list, normalizedTarget];
        this.writeFollowMap(map);
        return true;
    }

    unfollowLocal(authorId, session = null) {
        const followerKey = this.getFollowerKey(session);
        if (!followerKey) return false;

        const targetId = this.normalizeAuthorId(authorId);
        if (!targetId) return false;

        const map = this.readFollowMap();
        const list = Array.isArray(map[followerKey]) ? map[followerKey] : [];

        const next = list.filter(item => {
            if (item && typeof item === 'object') {
                return this.normalizeAuthorId(item.author_id ?? item.user_id ?? item.id) !== targetId;
            }
            return this.normalizeAuthorId(item) !== targetId;
        });

        map[followerKey] = next;
        this.writeFollowMap(map);
        return true;
    }

    toggleFollowLocal(target, session = null) {
        const targetId = this.normalizeAuthorId(
            target && typeof target === 'object' ? (target.author_id ?? target.user_id ?? target.id) : target
        );
        if (!targetId) return false;

        if (this.isFollowingLocal(targetId, session)) {
            this.unfollowLocal(targetId, session);
            return false;
        }

        this.followLocal(target, session);
        return true;
    }

    getFollowersCountLocal(authorId) {
        const targetId = this.normalizeAuthorId(authorId);
        if (!targetId) return 0;

        const map = this.readFollowMap();
        let count = 0;

        for (const followerKey of Object.keys(map)) {
            const list = Array.isArray(map[followerKey]) ? map[followerKey] : [];
            const isFollower = list.some(item => {
                if (item && typeof item === 'object') {
                    return this.normalizeAuthorId(item.author_id ?? item.user_id ?? item.id) === targetId;
                }
                return this.normalizeAuthorId(item) === targetId;
            });
            if (isFollower) count += 1;
        }

        return count;
    }

    async getAvatars() {
        const response = await this.request('/media/avatars', { method: 'GET' });
        return this.extractArray(response, ['avatars', 'data', 'items']);
    }

    // ========== ABONNEMENTS (BACKEND) ==========

    /**
     * Follow a user via the backend API, then sync the local cache.
     */
    async follow(authorId) {
        const id = this.normalizeAuthorId(authorId);
        if (!id) throw new Error('ID auteur invalide.');
        const data = await this.request('/follow', {
            method: 'POST',
            body: JSON.stringify({ followed_id: Number(id) }),
        });
        this.followLocal({ author_id: id }, this.getSession());
        return data;
    }

    /**
     * Unfollow a user via the backend API, then sync the local cache.
     */
    async unfollow(authorId) {
        const id = this.normalizeAuthorId(authorId);
        if (!id) throw new Error('ID auteur invalide.');
        const data = await this.request('/unfollow', {
            method: 'POST',
            body: JSON.stringify({ followed_id: Number(id) }),
        });
        this.unfollowLocal(id, this.getSession());
        return data;
    }

    /**
     * Get the real followers count for an author from the backend.
     * Falls back to the local count on network error.
     */
    async getFollowersCount(authorId) {
        const id = this.normalizeAuthorId(authorId);
        if (!id) return 0;
        try {
            const data = await this.request(`/follow/count/${id}`, { method: 'GET' });
            return data.followers_count ?? 0;
        } catch (e) {
            return this.getFollowersCountLocal(id);
        }
    }

    /**
     * Fetch the current user's following list from the backend and overwrite
     * the local cache entry for this session. Silent on network errors.
     */
    async hydrateFollowCache(session = null) {
        try {
            const data = await this.request('/me/following', { method: 'GET' });
            const following = Array.isArray(data.following) ? data.following : [];
            const s = session || this.getSession();
            const followerKey = this.getFollowerKey(s);
            if (!followerKey) return;
            const map = this.readFollowMap();
            map[followerKey] = following.map(item => ({
                author_id: String(item.author_id),
                code_name: item.code_name ?? null,
                avatar_seed: null,
            }));
            this.writeFollowMap(map);
        } catch (e) {
            // Silently fallback to existing local state
        }
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
