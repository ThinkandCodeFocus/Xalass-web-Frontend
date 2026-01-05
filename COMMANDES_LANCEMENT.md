# 🚀 Commandes pour Tester l'Intégration - Xalass

## 📋 Commandes Rapides

### Terminal 1 : Backend Laravel

```bash
cd Xalass_Backend
php artisan serve
```

**Résultat attendu :**
```
INFO  Server running on [http://127.0.0.1:8000]
```

---

### Terminal 2 : Frontend

```bash
cd Winku-Social-Network-Corporate-Responsive-Template
python -m http.server 8080
```

**Résultat attendu :**
```
Serving HTTP on 0.0.0.0 port 8080 (http://0.0.0.0:8080/) ...
```

---

## 🧪 Test de Connexion

Dans un **nouveau terminal**, testez la connexion au backend :

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -Method GET
```

**Résultat attendu :**
```json
{"status":"ok","database":"connected","timestamp":"..."}
```

---

## 🌐 Accès à l'Application

Une fois les deux serveurs lancés :

- **Page de login :** `http://localhost:8080/xalass-login.html`
- **Page feed :** `http://localhost:8080/xalass-feed.html`
- **API Health Check :** `http://127.0.0.1:8000/api/health`

---

## ⚠️ Important

- **Ne fermez PAS les terminaux** - Les serveurs doivent rester ouverts
- **Lancez d'abord le backend**, puis le frontend
- **Vérifiez les erreurs** dans les terminaux si quelque chose ne fonctionne pas

---

## 🛑 Arrêter les Serveurs

Appuyez sur `Ctrl+C` dans chaque terminal pour arrêter les serveurs.


