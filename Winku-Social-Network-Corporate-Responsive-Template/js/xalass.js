/* =====================================
   Xalass - JavaScript Principal
   Application de partage d'histoires anonymes
   ===================================== */

// === CONFIGURATION ===
const XALASS = {
    STORAGE_KEYS: {
        USERS: 'xalass_users',
        STORIES: 'xalass_stories',
        NOTIFICATIONS: 'xalass_notifications',
        SESSION: 'xalass_session'
    },
    CATEGORIES: ['amour', 'amitie', 'social', 'travail', 'autre'],
    AVATAR_COUNT: 18,
    REPORT_THRESHOLD: 5,
    DEMO_MODE: false
};

// === UTILITAIRES ===

// Génère un ID unique
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Formate le temps écoulé
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        an: 31536000,
        mois: 2592000,
        semaine: 604800,
        jour: 86400,
        heure: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `Il y a ${interval} ${unit}${interval > 1 && unit !== 'mois' ? 's' : ''}`;
        }
    }
    
    return 'À l\'instant';
}

// Génère l'URL de l'avatar DiceBear
function getAvatarUrl(seed) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

// === GESTION DU STOCKAGE ===

function getStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// === GESTION DE SESSION ===

function getSession() {
    return getStorage(XALASS.STORAGE_KEYS.SESSION);
}

function setSession(user) {
    setStorage(XALASS.STORAGE_KEYS.SESSION, user);
}

function clearSession() {
    localStorage.removeItem(XALASS.STORAGE_KEYS.SESSION);
}

function isValidBackendSession(session) {
    return !!(session && typeof session === 'object' && session.anon_uuid && (session.user_id || session.id));
}

function checkAuth(redirectToLogin = true) {
    const session = getSession();
    if (!isValidBackendSession(session)) {
        clearSession();
        if (redirectToLogin) {
            window.location.href = 'xalass-login.html';
        }
        return null;
    }

    // Compatibilite: certaines pages utilisent user_id.
    if (!session.user_id && session.id) {
        session.user_id = session.id;
        setSession(session);
    }

    // Backfill de l'avatar choisi (stocke localement) si non present dans la session.
    if ((session.avatar === undefined || session.avatar === null || session.avatar === '') && session.code_name) {
        try {
            const map = JSON.parse(localStorage.getItem('xalass_avatars_by_code_name') || '{}') || {};
            const key = String(session.code_name).trim().toLowerCase();
            const seed = map[key];
            if (Number.isFinite(seed)) {
                session.avatar = seed;
                setSession(session);
            }
        } catch (e) {
            // Ignore
        }
    }
    return session;
}

// === GESTION DES UTILISATEURS ===

function getUsers() {
    return getStorage(XALASS.STORAGE_KEYS.USERS) || [];
}

function saveUsers(users) {
    setStorage(XALASS.STORAGE_KEYS.USERS, users);
}

function findUser(pseudo, password = null) {
    const users = getUsers();
    if (password) {
        return users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase() && u.password === password);
    }
    return users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase());
}

function createUser(pseudo, password, avatar) {
    const users = getUsers();
    
    // Vérifier si le pseudo existe déjà
    if (findUser(pseudo)) {
        return { success: false, message: 'Ce pseudonyme est déjà pris' };
    }
    
    const newUser = {
        id: generateId(),
        pseudo: pseudo,
        password: password,
        avatar: avatar,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    return { success: true, user: newUser };
}

function loginUser(pseudo, password) {
    const user = findUser(pseudo, password);
    
    if (!user) {
        return { success: false, message: 'Pseudonyme ou mot de passe incorrect' };
    }
    
    setSession(user);
    return { success: true, user: user };
}

function logoutUser() {
    clearSession();
    window.location.href = 'xalass-login.html';
}

// === GESTION DES HISTOIRES ===

function getStories() {
    return getStorage(XALASS.STORAGE_KEYS.STORIES) || [];
}

function saveStories(stories) {
    setStorage(XALASS.STORAGE_KEYS.STORIES, stories);
}

function getStoryById(storyId) {
    const stories = getStories();
    return stories.find(s => s.id === storyId);
}

function publishStory(content, category, isAsuivre = false) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    const stories = getStories();
    
    const newStory = {
        id: generateId(),
        authorId: session.id,
        authorPseudo: session.pseudo,
        authorAvatar: session.avatar,
        content: content,
        category: category,
        isAsuivre: isAsuivre,
        likes: [],
        comments: [],
        reports: [],
        views: 0,
        createdAt: new Date().toISOString()
    };
    
    stories.unshift(newStory);
    saveStories(stories);
    
    return { success: true, story: newStory };
}

function deleteStory(storyId) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    let stories = getStories();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    
    if (storyIndex === -1) {
        return { success: false, message: 'Histoire non trouvée' };
    }
    
    if (stories[storyIndex].authorId !== session.id) {
        return { success: false, message: 'Vous ne pouvez supprimer que vos propres histoires' };
    }
    
    stories.splice(storyIndex, 1);
    saveStories(stories);
    
    return { success: true };
}

function updateStory(storyId, content, isAsuivre) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    let stories = getStories();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    
    if (storyIndex === -1) {
        return { success: false, message: 'Histoire non trouvée' };
    }
    
    if (stories[storyIndex].authorId !== session.id) {
        return { success: false, message: 'Vous ne pouvez modifier que vos propres histoires' };
    }
    
    stories[storyIndex].content = content;
    stories[storyIndex].isAsuivre = isAsuivre;
    stories[storyIndex].updatedAt = new Date().toISOString();
    saveStories(stories);
    
    return { success: true };
}

// === LIKES ===

function toggleLike(storyId, type = 'story', commentId = null, replyId = null) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    let stories = getStories();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    
    if (storyIndex === -1) {
        return { success: false, message: 'Histoire non trouvée' };
    }
    
    let target;
    let authorId;
    let notifType;
    
    if (type === 'story') {
        target = stories[storyIndex];
        authorId = target.authorId;
        notifType = 'like_story';
    } else if (type === 'comment' && commentId) {
        target = stories[storyIndex].comments.find(c => c.id === commentId);
        authorId = target?.authorId;
        notifType = 'like_comment';
    } else if (type === 'reply' && commentId && replyId) {
        const comment = stories[storyIndex].comments.find(c => c.id === commentId);
        target = comment?.replies?.find(r => r.id === replyId);
        authorId = target?.authorId;
        notifType = 'like_reply';
    }
    
    if (!target) {
        return { success: false, message: 'Cible non trouvée' };
    }
    
    if (!target.likes) target.likes = [];
    
    const likeIndex = target.likes.indexOf(session.id);
    let liked = false;
    
    if (likeIndex === -1) {
        target.likes.push(session.id);
        liked = true;
        
        // Notifier l'auteur si ce n'est pas lui-même
        if (authorId && authorId !== session.id) {
            addNotification({
                type: notifType,
                userId: authorId,
                fromUserId: session.id,
                fromPseudo: session.pseudo,
                fromAvatar: session.avatar,
                storyId: storyId,
                message: `${session.pseudo} a aimé ${type === 'story' ? 'votre histoire' : type === 'comment' ? 'votre commentaire' : 'votre réponse'}`
            });
        }
    } else {
        target.likes.splice(likeIndex, 1);
    }
    
    saveStories(stories);
    
    return { success: true, liked: liked, count: target.likes.length };
}

// === COMMENTAIRES ET RÉPONSES ===

function addComment(storyId, content) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    let stories = getStories();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    
    if (storyIndex === -1) {
        return { success: false, message: 'Histoire non trouvée' };
    }
    
    const newComment = {
        id: generateId(),
        authorId: session.id,
        authorPseudo: session.pseudo,
        authorAvatar: session.avatar,
        content: content,
        likes: [],
        replies: [],
        createdAt: new Date().toISOString()
    };
    
    stories[storyIndex].comments.push(newComment);
    saveStories(stories);
    
    // Notifier l'auteur de l'histoire
    const storyAuthorId = stories[storyIndex].authorId;
    if (storyAuthorId !== session.id) {
        addNotification({
            type: 'comment',
            userId: storyAuthorId,
            fromUserId: session.id,
            fromPseudo: session.pseudo,
            fromAvatar: session.avatar,
            storyId: storyId,
            message: `${session.pseudo} a commenté votre histoire`
        });
    }
    
    return { success: true, comment: newComment };
}

function addReply(storyId, commentId, content) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    let stories = getStories();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    
    if (storyIndex === -1) {
        return { success: false, message: 'Histoire non trouvée' };
    }
    
    const commentIndex = stories[storyIndex].comments.findIndex(c => c.id === commentId);
    
    if (commentIndex === -1) {
        return { success: false, message: 'Commentaire non trouvé' };
    }
    
    const newReply = {
        id: generateId(),
        authorId: session.id,
        authorPseudo: session.pseudo,
        authorAvatar: session.avatar,
        content: content,
        likes: [],
        createdAt: new Date().toISOString()
    };
    
    if (!stories[storyIndex].comments[commentIndex].replies) {
        stories[storyIndex].comments[commentIndex].replies = [];
    }
    
    stories[storyIndex].comments[commentIndex].replies.push(newReply);
    saveStories(stories);
    
    // Notifier l'auteur du commentaire
    const commentAuthorId = stories[storyIndex].comments[commentIndex].authorId;
    if (commentAuthorId !== session.id) {
        addNotification({
            type: 'reply',
            userId: commentAuthorId,
            fromUserId: session.id,
            fromPseudo: session.pseudo,
            fromAvatar: session.avatar,
            storyId: storyId,
            commentId: commentId,
            message: `${session.pseudo} a répondu à votre commentaire`
        });
    }
    
    return { success: true, reply: newReply };
}

// === SIGNALEMENTS ===

function submitReport(storyId, reason) {
    const session = getSession();
    if (!session) return { success: false, message: 'Non connecté' };
    
    let stories = getStories();
    const storyIndex = stories.findIndex(s => s.id === storyId);
    
    if (storyIndex === -1) {
        return { success: false, message: 'Histoire non trouvée' };
    }
    
    if (!stories[storyIndex].reports) {
        stories[storyIndex].reports = [];
    }
    
    // Vérifier si l'utilisateur a déjà signalé
    if (stories[storyIndex].reports.some(r => r.userId === session.id)) {
        return { success: false, message: 'Vous avez déjà signalé cette histoire' };
    }
    
    stories[storyIndex].reports.push({
        userId: session.id,
        reason: reason,
        createdAt: new Date().toISOString()
    });
    
    // Supprimer automatiquement si le seuil est atteint
    if (stories[storyIndex].reports.length >= XALASS.REPORT_THRESHOLD) {
        stories.splice(storyIndex, 1);
        saveStories(stories);
        return { success: true, deleted: true, message: 'L\'histoire a été supprimée suite à plusieurs signalements' };
    }
    
    saveStories(stories);
    
    return { success: true, message: 'Signalement enregistré. Merci pour votre vigilance.' };
}

// === NOTIFICATIONS ===

function getNotifications() {
    return getStorage(XALASS.STORAGE_KEYS.NOTIFICATIONS) || [];
}

function saveNotifications(notifications) {
    setStorage(XALASS.STORAGE_KEYS.NOTIFICATIONS, notifications);
}

function getUserNotifications(userId) {
    const notifications = getNotifications();
    return notifications.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addNotification(data) {
    const notifications = getNotifications();
    
    const newNotification = {
        id: generateId(),
        ...data,
        read: false,
        createdAt: new Date().toISOString()
    };
    
    notifications.unshift(newNotification);
    saveNotifications(notifications);
    
    return newNotification;
}

function markNotificationRead(notificationId) {
    let notifications = getNotifications();
    const index = notifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
        notifications[index].read = true;
        saveNotifications(notifications);
    }
}

function markAllNotificationsRead(userId) {
    let notifications = getNotifications();
    notifications.forEach(n => {
        if (n.userId === userId) {
            n.read = true;
        }
    });
    saveNotifications(notifications);
}

function deleteNotification(notificationId) {
    let notifications = getNotifications();
    notifications = notifications.filter(n => n.id !== notificationId);
    saveNotifications(notifications);
}

function getUnreadCount(userId) {
    const notifications = getNotifications();
    return notifications.filter(n => n.userId === userId && !n.read).length;
}

// === PARTAGE ===

function shareStory(storyId) {
    const story = getStoryById(storyId);
    if (!story) return;
    
    const shareUrl = window.location.origin + '/xalass-story.html?id=' + storyId;
    const shareText = story.content.substring(0, 100) + (story.content.length > 100 ? '...' : '');
    const shareTitle = `Histoire anonyme sur Xalass`;
    
    // Utiliser l'API Web Share si disponible
    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch(err => {
            console.log('Partage annulé');
        });
    } else {
        // Fallback: copier le lien
        copyToClipboard(shareUrl);
        showToast('Lien copié dans le presse-papier !');
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: #fff;
        padding: 12px 24px;
        border-radius: 25px;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// === RECHERCHE ===

function searchStories(query, category = null) {
    let stories = getStories();
    
    if (category && category !== 'all') {
        stories = stories.filter(s => s.category === category);
    }
    
    if (query && query.trim()) {
        const searchTerms = query.toLowerCase().split(' ');
        stories = stories.filter(s => {
            const content = s.content.toLowerCase();
            const pseudo = s.authorPseudo.toLowerCase();
            return searchTerms.some(term => content.includes(term) || pseudo.includes(term));
        });
    }
    
    return stories;
}

// === STATISTIQUES UTILISATEUR ===

function getUserStats(userId) {
    const stories = getStories();
    const userStories = stories.filter(s => s.authorId === userId);
    
    let totalLikes = 0;
    let totalComments = 0;
    
    userStories.forEach(s => {
        totalLikes += s.likes ? s.likes.length : 0;
        totalComments += s.comments ? s.comments.length : 0;
    });
    
    return {
        storiesCount: userStories.length,
        likesCount: totalLikes,
        commentsCount: totalComments
    };
}

// === GÉNÉRATION DE PSEUDOS ===

function generatePseudoSuggestions() {
    const adjectives = ['Mystique', 'Discret', 'Secret', 'Anonyme', 'Nocturne', 'Invisible', 'Sage', 'Libre', 'Curieux', 'Sincère', 'Fidèle', 'Rêveur'];
    const nouns = ['Voyageur', 'Poète', 'Conteur', 'Penseur', 'Artiste', 'Confident', 'Témoin', 'Passant', 'Lecteur', 'Écrivain', 'Narrateur', 'Ami'];
    
    const suggestions = [];
    for (let i = 0; i < 5; i++) {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 99) + 1;
        suggestions.push(`${adj}${noun}${num}`);
    }
    
    return suggestions;
}

// === DONNÉES DE DÉMONSTRATION ===

function initDemoData() {
    // Vérifier si les données existent déjà
    if (getStories().length > 0) return;
    
    // Créer des utilisateurs de démo
    const demoUsers = [
        { id: 'demo1', pseudo: 'AnonymePoète42', password: 'demo', avatar: 1, createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
        { id: 'demo2', pseudo: 'SecretConteur17', password: 'demo', avatar: 5, createdAt: new Date(Date.now() - 86400000 * 25).toISOString() },
        { id: 'demo3', pseudo: 'LibrePenseur99', password: 'demo', avatar: 10, createdAt: new Date(Date.now() - 86400000 * 20).toISOString() },
        { id: 'demo4', pseudo: 'NocturneAmi33', password: 'demo', avatar: 15, createdAt: new Date(Date.now() - 86400000 * 15).toISOString() }
    ];
    
    saveUsers(demoUsers);
    
    // Créer des histoires de démo
    const demoStories = [
        {
            id: 'story1',
            authorId: 'demo1',
            authorPseudo: 'AnonymePoète42',
            authorAvatar: 1,
            content: "Aujourd'hui, j'ai enfin osé lui dire ce que je ressentais. Après 3 ans à garder ce secret, les mots sont sortis d'eux-mêmes. Son sourire m'a fait comprendre que j'aurais dû parler bien avant...",
            category: 'amour',
            isAsuivre: false,
            likes: ['demo2', 'demo3', 'demo4'],
            comments: [
                {
                    id: 'comment1',
                    authorId: 'demo2',
                    authorPseudo: 'SecretConteur17',
                    authorAvatar: 5,
                    content: "Quelle belle histoire ! Le courage paie toujours 💪",
                    likes: ['demo1', 'demo3'],
                    replies: [
                        {
                            id: 'reply1',
                            authorId: 'demo1',
                            authorPseudo: 'AnonymePoète42',
                            authorAvatar: 1,
                            content: "Merci beaucoup ! Je ne regrette rien 😊",
                            likes: ['demo2'],
                            createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
                        }
                    ],
                    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
                }
            ],
            reports: [],
            views: 127,
            createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
        },
        {
            id: 'story2',
            authorId: 'demo2',
            authorPseudo: 'SecretConteur17',
            authorAvatar: 5,
            content: "Mon meilleur ami ne sait pas que c'est moi qui ai payé sa facture d'hôpital. Il traversait une période difficile et je ne pouvais pas rester sans rien faire. Certains secrets méritent d'être gardés...",
            category: 'amitie',
            isAsuivre: false,
            likes: ['demo1', 'demo3', 'demo4'],
            comments: [
                {
                    id: 'comment2',
                    authorId: 'demo3',
                    authorPseudo: 'LibrePenseur99',
                    authorAvatar: 10,
                    content: "Tu es une personne exceptionnelle. L'amitié vraie, c'est ça.",
                    likes: ['demo1', 'demo2', 'demo4'],
                    replies: [],
                    createdAt: new Date(Date.now() - 86400000).toISOString()
                }
            ],
            reports: [],
            views: 89,
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
            id: 'story3',
            authorId: 'demo3',
            authorPseudo: 'LibrePenseur99',
            authorAvatar: 10,
            content: "Chapitre 1 : Le jour où tout a basculé\n\nJe ne savais pas encore que cette rencontre allait changer ma vie. Le café était bondé ce matin-là, et la seule place disponible était face à un inconnu qui lisait le même livre que moi...",
            category: 'social',
            isAsuivre: true,
            likes: ['demo1', 'demo4'],
            comments: [],
            reports: [],
            views: 234,
            createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
        },
        {
            id: 'story4',
            authorId: 'demo4',
            authorPseudo: 'NocturneAmi33',
            authorAvatar: 15,
            content: "J'ai démissionné aujourd'hui. Après 10 ans dans la même entreprise, j'ai choisi de suivre ma passion. Tout le monde pense que je suis fou, mais pour la première fois depuis longtemps, je me sens vivant.",
            category: 'travail',
            isAsuivre: false,
            likes: ['demo1', 'demo2', 'demo3'],
            comments: [
                {
                    id: 'comment3',
                    authorId: 'demo1',
                    authorPseudo: 'AnonymePoète42',
                    authorAvatar: 1,
                    content: "Le courage de suivre ses rêves, c'est admirable ! Quelle est ta passion ?",
                    likes: ['demo4'],
                    replies: [
                        {
                            id: 'reply2',
                            authorId: 'demo4',
                            authorPseudo: 'NocturneAmi33',
                            authorAvatar: 15,
                            content: "La photographie de paysages. Je pars bientôt en voyage ! 📷",
                            likes: ['demo1', 'demo2'],
                            createdAt: new Date(Date.now() - 3600000).toISOString()
                        }
                    ],
                    createdAt: new Date(Date.now() - 7200000).toISOString()
                }
            ],
            reports: [],
            views: 156,
            createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
        }
    ];
    
    saveStories(demoStories);
    
    // Créer des notifications de démo
    const demoNotifications = [
        {
            id: 'notif1',
            type: 'like_story',
            userId: 'demo1',
            fromUserId: 'demo2',
            fromPseudo: 'SecretConteur17',
            fromAvatar: 5,
            storyId: 'story1',
            message: 'SecretConteur17 a aimé votre histoire',
            read: false,
            createdAt: new Date(Date.now() - 3600000).toISOString()
        }
    ];
    
    saveNotifications(demoNotifications);
    
    console.log('Données de démonstration initialisées');
}

// === HELPERS DE RENDU ===

function getCategoryLabel(category) {
    const labels = {
        'amour': 'Amour',
        'amitie': 'Amitié',
        'social': 'Social',
        'travail': 'Travail',
        'autre': 'Autre'
    };
    return labels[category] || 'Autre';
}

function getCategoryIcon(category) {
    const icons = {
        'amour': 'fa-heart',
        'amitie': 'fa-users',
        'social': 'fa-globe',
        'travail': 'fa-briefcase',
        'autre': 'fa-star'
    };
    return icons[category] || 'fa-star';
}

// Tri des commentaires par popularité
function sortCommentsByPopularity(comments) {
    return comments.slice().sort((a, b) => {
        const likesA = a.likes ? a.likes.length : 0;
        const likesB = b.likes ? b.likes.length : 0;
        return likesB - likesA;
    });
}

// Incrémente les vues
function incrementViews(storyId) {
    let stories = getStories();
    const index = stories.findIndex(s => s.id === storyId);
    if (index !== -1) {
        stories[index].views = (stories[index].views || 0) + 1;
        saveStories(stories);
    }
}

// === INITIALISATION ===

function shouldInitDemoData() {
    if (window.XALASS_ENABLE_DEMO_DATA === true) {
        return true;
    }

    if (XALASS.DEMO_MODE) {
        return true;
    }

    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('demo') === '1';
    } catch (error) {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser les données de démo au premier lancement
    if (shouldInitDemoData()) {
        initDemoData();
    }
    
    // Ajouter les styles pour les animations toast
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});
