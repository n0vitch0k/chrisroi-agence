# Déploiement PocketBase sur VPS

## Prérequis
- Un VPS (ex: Hetzner CX22 à 4 €/mois — 2 vCPU, 4 Go RAM, 40 Go SSD)
- Le binaire PocketBase pour Linux AMD64

---

## 1. Installer PocketBase sur le VPS

Se connecter en SSH :

```bash
ssh root@<IP_DU_VPS>
```

Télécharger et installer PocketBase :

```bash
# Télécharger la dernière version Linux
wget https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_0.27.0_linux_amd64.zip
unzip pocketbase_0.27.0_linux_amd64.zip
rm pocketbase_0.27.0_linux_amd64.zip

# Déplacer dans /opt
mkdir -p /opt/pocketbase
mv pocketbase /opt/pocketbase/
chmod +x /opt/pocketbase/pocketbase

# Créer le dossier de données
mkdir -p /opt/pocketbase/pb_data
```

## 2. Créer l'admin et importer les collections

```bash
cd /opt/pocketbase

# Lancer PocketBase temporairement
./pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data &

# Créer l'admin
curl -X POST http://127.0.0.1:8090/api/admins \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chrisroi.com","password":"chrisroi2024"}'

# Arrêter le processus temporaire
kill %1
```

## 3. Créer les collections

Tu dois créer les mêmes collections que sur ton PocketBase local. Connecte-toi au dashboard :

```bash
./pocketbase serve --http=0.0.0.0:8090 --dir=./pb_data
```

Ouvre `http://<IP_DU_VPS>:8090/_/` dans ton navigateur et connecte-toi avec admin@chrisroi.com.

Crée les collections une par une (clique sur "New collection" et importe le schéma depuis ton PC). Les collections nécessaires :
- employes
- employeurs
- contrats
- alertes
- parents
- personnes_urgence
- experiences_pro

## 4. Configurer le service systemd (redémarrage automatique)

```bash
cat > /etc/systemd/system/pocketbase.service << 'EOF'
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=0.0.0.0:8090 --dir=/opt/pocketbase/pb_data
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Activer et démarrer
systemctl daemon-reload
systemctl enable pocketbase
systemctl start pocketbase
systemctl status pocketbase
```

## 5. Ajouter HTTPS avec Caddy (recommandé, automatique)

```bash
# Installer Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy

# Configurer le proxy HTTPS
cat > /etc/caddy/Caddyfile << 'EOF'
chrisroi-agence.com {
    reverse_proxy localhost:8090
}
EOF

systemctl restart caddy
```

> Sans nom de domaine, tu peux aussi utiliser Fly.io, Railway ou un tunnel Cloudflare pour avoir du HTTPS gratuit.

## 6. Configurer les backups automatiques

```bash
cat > /opt/pocketbase/backup.sh << 'EOFBACKUP'
#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/opt/pocketbase/backups"
mkdir -p $BACKUP_DIR

# Copier la base SQLite
cp /opt/pocketbase/pb_data/data.db $BACKUP_DIR/data-$DATE.db

# Compresser
gzip $BACKUP_DIR/data-$DATE.db

# Supprimer les backups de plus de 30 jours
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup terminé : data-$DATE.db.gz"
EOFBACKUP

chmod +x /opt/pocketbase/backup.sh

# Ajouter une cron hebdomadaire
crontab -e
# Ajouter : 0 3 * * 0 /opt/pocketbase/backup.sh
```

---

## 7. Builder l'APK avec l'URL du VPS

Sur ton PC, dans `app.json` :

```json
"extra": {
  "eas": { "projectId": "be00e727-aaea-4a45-b61f-cb9a5dbc0b11" },
  "pocketbaseUrl": "https://chrisroi-agence.com"
}
```

Puis builder :

```bash
npx eas build -p android --profile preview
```

---

## 8. Transférer les données existantes

Si tu veux garder les employés/contrats que tu as déjà saisis en local :

```bash
# Sur ton PC, PocketBase doit être arrêté
# Copier le fichier data.db vers le VPS
scp pocketbase/pb_data/data.db root@<IP_DU_VPS>:/opt/pocketbase/pb_data/

# Redémarrer PocketBase sur le VPS
ssh root@<IP_DU_VPS> "systemctl restart pocketbase"
```
