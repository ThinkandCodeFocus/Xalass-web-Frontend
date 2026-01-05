# 📱 Xalass - Réseau Social Anonyme

Xalass est une plateforme de partage d'histoires anonymes où les utilisateurs peuvent créer, partager et interagir avec des posts de manière anonyme.

## 🎯 Fonctionnalités

- ✅ **Authentification anonyme** avec UUID
- ✅ **Création et publication de posts** avec catégories
- ✅ **Système de likes/réactions** sur les posts
- ✅ **Commentaires** sur les posts
- ✅ **Notifications** en temps réel
- ✅ **Recherche et filtrage** par catégorie
- ✅ **Profil utilisateur** avec statistiques

## 🏗️ Architecture

- **Frontend** : HTML/CSS/JavaScript (Vanilla JS)
- **Backend** : Laravel (PHP) avec API REST
- **Base de données** : MySQL
- **Authentification** : Système anonyme avec UUID

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **PHP** >= 8.1 avec les extensions suivantes :
  - BCMath
  - Ctype
  - Fileinfo
  - JSON
  - Mbstring
  - OpenSSL
  - PDO
  - Tokenizer
  - XML

- **Composer** (gestionnaire de dépendances PHP)
- **MySQL** >= 5.7 ou MariaDB >= 10.3
- **Python** >= 3.7 (pour le serveur frontend) ou **PHP** (alternative)
- **Git**

### Vérification des prérequis

**Windows (PowerShell) :**
```powershell
php --version
composer --version
python --version
mysql --version
```

**Linux/Mac :**
```bash
php --version
composer --version
python3 --version
mysql --version
```

---

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone <URL_DU_REPO>
cd Xalass-web-Frontend
```

### 2. Configuration du Backend

#### 2.1 Installer les dépendances PHP

```bash
cd Xalass_Backend
composer install
```

#### 2.2 Configuration de l'environnement

Copiez le fichier `.env.example` vers `.env` :

```bash
copy .env.example .env
```

Ou sur Linux/Mac :
```bash
cp .env.example .env
```

#### 2.3 Configurer la base de données

Ouvrez le fichier `.env` et configurez votre base de données :

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=xalass_db
DB_USERNAME=votre_utilisateur
DB_PASSWORD=votre_mot_de_passe
```

#### 2.4 Générer la clé d'application

```bash
php artisan key:generate
```

#### 2.5 Créer la base de données

Créez une base de données MySQL nommée `xalass_db` (ou le nom que vous avez configuré dans `.env`).

#### 2.6 Exécuter les migrations

```bash
php artisan migrate
```

Cela créera toutes les tables nécessaires :
- `anonymous_users` - Utilisateurs anonymes
- `posts` - Posts/histoires
- `comments` - Commentaires
- `reactions` - Réactions (likes)
- `notifications` - Notifications

#### 2.7 (Optionnel) Charger des données de test

```bash
php artisan db:seed
```

---

## 🎮 Lancement de l'Application

### Méthode 1 : Fichiers Batch (Windows - Recommandé)

1. **Lancer le Backend :**
   - Double-cliquez sur `LANCER_BACKEND.bat`
   - Une fenêtre de terminal s'ouvre
   - Vous devriez voir : `Server running on [http://127.0.0.1:8000]`
   - **⚠️ Ne fermez PAS cette fenêtre**

2. **Lancer le Frontend :**
   - Double-cliquez sur `LANCER_FRONTEND.bat`
   - Une autre fenêtre de terminal s'ouvre
   - Vous devriez voir : `Serving HTTP on 0.0.0.0 port 8080`
   - **⚠️ Ne fermez PAS cette fenêtre**

3. **Ouvrir l'application :**
   - Ouvrez votre navigateur
   - Allez sur : `http://localhost:8080/xalass-login.html`

### Méthode 2 : Ligne de commande

#### Terminal 1 - Backend Laravel

```bash
cd Xalass_Backend
php artisan serve
```

**Résultat attendu :**
```
INFO  Server running on [http://127.0.0.1:8000]
```

#### Terminal 2 - Frontend

**Option A : Python (Recommandé)**
```bash
cd Winku-Social-Network-Corporate-Responsive-Template
python -m http.server 8080
```

**Option B : PHP**
```bash
cd Winku-Social-Network-Corporate-Responsive-Template
php -S localhost:8080
```

**Option C : Node.js (si installé)**
```bash
cd Winku-Social-Network-Corporate-Responsive-Template
npx http-server -p 8080
```

**Résultat attendu :**
```
Serving HTTP on 0.0.0.0 port 8080 (http://0.0.0.0:8080/) ...
```

---

## 🧪 Tests

### Test de connexion Backend

Dans un nouveau terminal :

**Windows (PowerShell) :**
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -Method GET
```

**Linux/Mac :**
```bash
curl http://127.0.0.1:8000/api/health
```

**Résultat attendu :**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-01-04T..."
}
```

### Test de l'application

1. **Page de login :** `http://localhost:8080/xalass-login.html`
   - Créez un compte ou connectez-vous
   - Vous recevrez un UUID anonyme

2. **Page feed :** `http://localhost:8080/xalass-feed.html`
   - Créez un nouveau post
   - Likez des posts
   - Ajoutez des commentaires

3. **Page profil :** `http://localhost:8080/xalass-profile.html`
   - Consultez vos statistiques

---

## 📁 Structure du Projet

```
Xalass-web-Frontend/
├── Xalass_Backend/              # Backend Laravel
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/    # Contrôleurs API
│   │   │   └── Middleware/      # Middleware d'authentification
│   │   ├── Models/              # Modèles Eloquent
│   │   └── services/            # Services métier
│   ├── database/
│   │   └── migrations/          # Migrations de base de données
│   ├── routes/
│   │   └── api.php              # Routes API
│   └── .env                     # Configuration (à créer)
│
└── Winku-Social-Network-Corporate-Responsive-Template/  # Frontend
    ├── js/
    │   ├── api.js               # Service API JavaScript
    │   ├── config.js            # Configuration API
    │   └── xalass.js            # Fonctions utilitaires
    ├── css/                     # Styles CSS
    ├── images/                  # Images et ressources
    └── xalass-*.html            # Pages HTML
        ├── xalass-login.html    # Page de connexion
        ├── xalass-feed.html     # Page principale (feed)
        ├── xalass-story.html    # Détail d'un post
        ├── xalass-profile.html  # Profil utilisateur
        ├── xalass-search.html   # Recherche
        └── xalass-notifications.html  # Notifications
```

---

## 🔧 Configuration

### Configuration Frontend

Le fichier `Winku-Social-Network-Corporate-Responsive-Template/js/config.js` contient l'URL du backend :

```javascript
const API_CONFIG = {
    BASE_URL: 'http://127.0.0.1:8000/api',
    // ...
};
```

Si votre backend tourne sur un autre port ou domaine, modifiez cette URL.

### Configuration Backend

Les principales configurations sont dans `Xalass_Backend/.env` :

- **Base de données** : `DB_*`
- **Application** : `APP_*`
- **CORS** : Configuré dans `config/cors.php`

---

## 📡 API Endpoints

### Authentification
- `POST /api/create/anoUser` - Créer un utilisateur anonyme
- `POST /api/login/anoUser` - Se connecter

### Posts
- `POST /api/create/posts` - Créer un post
- `POST /api/all/posts` - Récupérer tous les posts (paginé)
- `POST /api/author/posts` - Posts d'un auteur
- `POST /api/category/posts` - Posts par catégorie
- `GET /api/posts/{id}` - Détails d'un post
- `POST /api/update/posts` - Mettre à jour un post
- `POST /api/delete/posts` - Supprimer un post

### Réactions
- `POST /api/posts/{id}/reactions` - Liker/unliker un post
- `POST /api/comments/{id}/reactions` - Liker/unliker un commentaire

### Commentaires
- `POST /api/create/comment` - Créer un commentaire
- `GET /api/posts/{id}/comments` - Commentaires d'un post
- `POST /api/delete/comment` - Supprimer un commentaire

### Notifications
- `GET /api/notifications` - Récupérer les notifications
- `PUT /api/notifications/{id}/read` - Marquer comme lu
- `PUT /api/notifications/read-all` - Tout marquer comme lu
- `DELETE /api/notifications/{id}` - Supprimer une notification

### Utilitaires
- `GET /api/health` - Vérifier l'état du serveur et de la base de données
- `GET /api/media/avatars` - Liste des avatars disponibles

**Note :** La plupart des endpoints nécessitent l'authentification via le header `X-Anon-ID`.

---

## 🐛 Dépannage

### Le backend ne démarre pas

**Erreur :** `Class 'PDO' not found`
- **Solution :** Installez l'extension PDO pour PHP

**Erreur :** `SQLSTATE[HY000] [2002] No connection could be made`
- **Solution :** Vérifiez que MySQL est démarré et que les identifiants dans `.env` sont corrects

**Erreur :** `The stream or file could not be opened`
- **Solution :** Vérifiez les permissions du dossier `storage/` :
  ```bash
  chmod -R 775 storage bootstrap/cache
  ```

### Le frontend ne se charge pas

**Erreur :** `ERR_EMPTY_RESPONSE`
- **Solution :** 
  1. Vérifiez que le serveur frontend est bien lancé
  2. Vérifiez qu'aucun autre processus n'utilise le port 8080
  3. Essayez un autre port : `python -m http.server 3000`

**Erreur :** `CORS policy: No 'Access-Control-Allow-Origin'`
- **Solution :** Vérifiez que le backend est bien démarré et que CORS est configuré dans `config/cors.php`

### Les posts ne se chargent pas

**Erreur dans la console :** `Impossible de se connecter au serveur`
- **Solution :** 
  1. Vérifiez que le backend est lancé : `http://127.0.0.1:8000/api/health`
  2. Vérifiez l'URL dans `js/config.js`
  3. Ouvrez la console (F12) et vérifiez les erreurs réseau

### La publication ne fonctionne pas

**Le bouton reste sur "Publication..."**
- **Solution :** 
  1. Vérifiez que vous êtes connecté (UUID présent dans localStorage)
  2. Vérifiez la console (F12) pour les erreurs
  3. Vérifiez que le backend répond : `http://127.0.0.1:8000/api/health`

---

## 🔍 Vérifications Rapides

### Checklist de démarrage

- [ ] PHP installé et dans le PATH
- [ ] Composer installé
- [ ] MySQL démarré
- [ ] Base de données créée
- [ ] Fichier `.env` configuré
- [ ] Migrations exécutées (`php artisan migrate`)
- [ ] Backend lancé sur le port 8000
- [ ] Frontend lancé sur le port 8080
- [ ] Test `/api/health` répond OK

---

## 📝 Commandes Utiles

### Backend

```bash
# Installer les dépendances
composer install

# Exécuter les migrations
php artisan migrate

# Vider le cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# Voir les routes
php artisan route:list

# Voir les logs
tail -f storage/logs/laravel.log
```

### Base de données

```bash
# Se connecter à MySQL
mysql -u votre_utilisateur -p

# Voir les tables
SHOW TABLES;

# Voir les posts
SELECT * FROM posts LIMIT 10;

# Compter les posts
SELECT COUNT(*) FROM posts;
```

---

## 🌐 URLs de l'Application

Une fois les serveurs lancés :

- **Login :** `http://localhost:8080/xalass-login.html`
- **Feed :** `http://localhost:8080/xalass-feed.html`
- **Profil :** `http://localhost:8080/xalass-profile.html`
- **Recherche :** `http://localhost:8080/xalass-search.html`
- **Notifications :** `http://localhost:8080/xalass-notifications.html`
- **Détail post :** `http://localhost:8080/xalass-story.html?id=1`

**API :**
- **Health Check :** `http://127.0.0.1:8000/api/health`
- **API Base :** `http://127.0.0.1:8000/api`

---

## 🛑 Arrêter les Serveurs

Pour arrêter les serveurs, appuyez sur `Ctrl+C` dans chaque terminal où ils tournent.

**Windows :** Si les processus restent bloqués :
```powershell
Get-Process php | Stop-Process -Force
Get-Process python | Stop-Process -Force
```

---

## 📚 Documentation Supplémentaire

- [Laravel Documentation](https://laravel.com/docs)
- [API Routes](Xalass_Backend/routes/api.php)
- [Commandes de lancement](COMMANDES_LANCEMENT.md)

---

## 🤝 Contribution

Pour contribuer au projet :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📄 Licence

Ce projet est sous licence MIT.

---

## 👥 Auteurs

- Équipe Xalass

---

## 🙏 Remerciements

- Laravel Framework
- Winku Template

---

**Bon développement ! 🚀**

