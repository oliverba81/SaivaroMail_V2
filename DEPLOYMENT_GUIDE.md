# SAIVAROMAIL - Hetzner Server Deployment Guide

**Projekt**: SAIVAROMAIL (Mailclient + SCC Backend + SCC Frontend)  
**Domain**: www.saivaro.de  
**Server**: Hetzner  
**Ports**: 3002 (Mailclient), 3100 (SCC Backend), 3003 (SCC Frontend)

---

## WICHTIG: Vor dem Start lesen!

- ⚠️ **NIEMALS als root deployen** - Immer als `deployer` User arbeiten
- ⚠️ **Alle Secrets generieren** - Nie Beispiel-Passwörter verwenden
- ⚠️ **SSH-Session offen lassen** - Vor SSH-Härtung neue Session testen
- ⚠️ **Backups machen** - Vor jeder größeren Änderung

---

## Phase 1: System-Vorbereitung (als root)

### 1.1 Deployment-User erstellen

```bash
# Als root einloggen
ssh root@ihr-server

# Deployer-User erstellen
adduser --disabled-password --gecos "" deployer

# Sudo-Rechte geben
usermod -aG sudo deployer

# SSH-Key für deployer generieren
sudo -u deployer ssh-keygen -t ed25519 -C "deployer@saivaromail"

# Public Key anzeigen (für authorized_keys)
cat /home/deployer/.ssh/id_ed25519.pub
```

### 1.2 SSH härten (VORSICHT!)

```bash
# WICHTIG: Neue SSH-Session öffnen und OFFEN LASSEN!
# Erst wenn neue Session funktioniert, alte schließen!

# SSH-Konfiguration bearbeiten
nano /etc/ssh/sshd_config

# Folgende Änderungen vornehmen:
Port 2222                          # SSH-Port ändern
PermitRootLogin no                 # Root-Login verbieten
PasswordAuthentication no          # Nur SSH-Keys
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deployer                # Nur deployer erlauben
X11Forwarding no
Protocol 2

# SSH neu starten
systemctl restart sshd

# IN NEUER SESSION TESTEN:
ssh -p 2222 deployer@ihr-server
```

### 1.3 Kernel Hardening

```bash
# Sysctl Härtung
nano /etc/sysctl.conf

# Am Ende hinzufügen:
# IP Spoofing Protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
# Log Martians
net.ipv4.conf.all.log_martians = 1
# SYN Flood Protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5
# IP Forward
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Änderungen anwenden
sysctl -p
```

### 1.4 Automatische Security Updates

```bash
apt-get update
apt-get install -y unattended-upgrades apt-listchanges

# Konfigurieren
dpkg-reconfigure -plow unattended-upgrades
```

### 1.5 Firewall (UFW)

```bash
# UFW installieren (falls nicht vorhanden)
apt-get install -y ufw

# Ports konfigurieren
ufw allow 2222/tcp    # SSH (neuer Port)
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS

# Alten SSH-Port schließen
ufw delete allow 22/tcp

# Firewall aktivieren
ufw enable

# Status prüfen
ufw status verbose
```

### 1.6 Fail2ban

```bash
# Fail2ban installieren
apt-get install -y fail2ban

# SSH Jail konfigurieren
cat > /etc/fail2ban/jail.d/sshd.conf << 'EOF'
[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF

# NGINX Jail konfigurieren
cat > /etc/fail2ban/jail.d/nginx.conf << 'EOF'
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/*error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/*error.log
findtime = 600
bantime = 7200
maxretry = 10
EOF

# Fail2ban starten
systemctl enable fail2ban
systemctl start fail2ban
systemctl status fail2ban
```

---

## Phase 2: PostgreSQL-Datenbank (als root)

### 2.1 PostgreSQL SSL aktivieren

```bash
# postgresql.conf bearbeiten
nano /etc/postgresql/15/main/postgresql.conf

# Änderungen:
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'
listen_addresses = 'localhost'
max_connections = 50
shared_buffers = 256MB
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'ddl'
log_min_duration_statement = 1000
```

### 2.2 Datenbank und User erstellen

```bash
# Als postgres-User einloggen
sudo -u postgres psql

# Starkes Passwort generieren
openssl rand -base64 32
# Beispiel-Output: xK9mP2nL5vR8qT3wY6sF4jN7gH1cB0aD

# Datenbank erstellen
CREATE DATABASE saivaromail_db;

# User mit starkem Passwort erstellen
CREATE USER saivaromail_user WITH 
  PASSWORD 'IHR_GENERIERTES_PASSWORT_HIER'
  VALID UNTIL '2027-01-01'
  LOGIN
  CONNECTION LIMIT 20;

# Rechte vergeben
GRANT ALL PRIVILEGES ON DATABASE saivaromail_db TO saivaromail_user;
ALTER DATABASE saivaromail_db OWNER TO saivaromail_user;

# Zur Datenbank wechseln
\c saivaromail_db

# Schema-Rechte vergeben
GRANT ALL ON SCHEMA public TO saivaromail_user;
GRANT CREATE ON SCHEMA public TO saivaromail_user;
ALTER SCHEMA public OWNER TO saivaromail_user;

# Default Privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO saivaromail_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO saivaromail_user;

# Verlassen
\q
```

### 2.3 pg_hba.conf härten

```bash
# pg_hba.conf bearbeiten
nano /etc/postgresql/15/main/pg_hba.conf

# NUR folgende Zeilen aktiv lassen:
# TYPE  DATABASE         USER              ADDRESS         METHOD
local   saivaromail_db   saivaromail_user                  md5
host    saivaromail_db   saivaromail_user  127.0.0.1/32    md5
host    saivaromail_db   saivaromail_user  ::1/128         md5

# Alle anderen auf reject setzen
local   all             all                                reject
host    all             all                0.0.0.0/0       reject

# PostgreSQL neu laden
systemctl reload postgresql

# Verbindung testen
psql -U saivaromail_user -d saivaromail_db -h localhost
```

---

## Phase 3: Node.js, pnpm & PM2 (als deployer)

### 3.1 Von jetzt an als deployer arbeiten

```bash
# Als deployer einloggen
ssh -p 2222 deployer@ihr-server
```

### 3.2 Node.js installieren (als deployer mit sudo)

```bash
# Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Version prüfen
node --version  # sollte >= 20.0.0 sein
```

### 3.3 pnpm installieren

```bash
# pnpm global installieren
sudo npm install -g pnpm

# Version prüfen
pnpm --version

# Shared Store konfigurieren (spart Speicher)
pnpm config set store-dir /home/deployer/.pnpm-store
```

### 3.4 PM2 installieren

```bash
# PM2 global installieren
sudo npm install -g pm2

# PM2 beim Systemstart
pm2 startup
# Befehl ausführen, der angezeigt wird (mit sudo)

# Version prüfen
pm2 --version
```

---

## Phase 4: Projekt-Setup (als deployer)

### 4.1 Verzeichnisse erstellen

```bash
# Als deployer
mkdir -p /home/deployer/apps/saivaromail-releases
mkdir -p /home/deployer/backups/saivaromail
mkdir -p /home/deployer/logs
mkdir -p /home/deployer/scripts
```

### 4.2 Code auf Server bringen

**Option A: Git Clone**
```bash
cd /home/deployer/apps/saivaromail-releases
git clone https://github.com/IHR-REPO/saivaromail.git $(date +%Y%m%d_%H%M%S)
cd $(ls -t | head -1)
```

**Option B: Von lokalem PC hochladen (auf lokalem PC)**
```bash
# Von Ihrem Windows-PC
cd C:\Users\Buero-Oliver\Documents\Cursor-Projekte\SeivaroMail_v2

# rsync oder scp
scp -P 2222 -r . deployer@ihr-server:/home/deployer/apps/saivaromail-releases/$(date +%Y%m%d_%H%M%S)/
```

### 4.3 Symlink erstellen

```bash
# Als deployer auf Server
cd /home/deployer/apps
ln -sfn saivaromail-releases/$(ls -t saivaromail-releases | head -1) saivaromail
cd saivaromail
```

### 4.4 .gitignore prüfen

```bash
# Prüfen ob .gitignore existiert
cat .gitignore

# Falls nicht, erstellen:
cat > .gitignore << 'EOF'
# Environment Variables
.env
.env.local
.env.production
.env.*.local
*.env
# Secrets
secrets/
*.key
*.pem
*.p12
*.pfx
# Backups
*.sql
*.sql.gz
*.dump
# Logs
*.log
logs/
# node_modules
node_modules/
dist/
.next/
EOF
```

### 4.5 Secrets generieren

```bash
# JWT Secret (32+ Zeichen)
openssl rand -base64 32

# Session Secret (anderer Wert!)
openssl rand -base64 32

# Speichern Sie diese Werte sicher!
```

### 4.6 .env.production Dateien erstellen

**apps/mailclient/.env.production:**
```bash
cat > apps/mailclient/.env.production << 'EOF'
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://saivaromail_user:IHR_DB_PASSWORT@localhost:5432/saivaromail_db?connection_limit=10&pool_timeout=20&sslmode=prefer
JWT_SECRET=IHR_JWT_SECRET_HIER
SESSION_SECRET=IHR_SESSION_SECRET_HIER
NEXT_PUBLIC_API_URL=https://www.saivaro.de/api
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict
EOF

chmod 600 apps/mailclient/.env.production
```

**apps/scc/.env.production:**
```bash
cat > apps/scc/.env.production << 'EOF'
NODE_ENV=production
PORT=3100
DATABASE_URL=postgresql://saivaromail_user:IHR_DB_PASSWORT@localhost:5432/saivaromail_db?connection_limit=10&pool_timeout=20&sslmode=prefer
JWT_SECRET=IHR_JWT_SECRET_HIER
SESSION_SECRET=IHR_SESSION_SECRET_HIER
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://www.saivaro.de
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,PATCH,DELETE
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_MAX_AGE=86400
THROTTLE_TTL=60
THROTTLE_LIMIT=10
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict
EOF

chmod 600 apps/scc/.env.production
```

**apps/scc-frontend/.env.production:**
```bash
cat > apps/scc-frontend/.env.production << 'EOF'
NODE_ENV=production
PORT=3003
NEXT_PUBLIC_API_URL=https://www.saivaro.de/api
EOF

chmod 600 apps/scc-frontend/.env.production
```

### 4.7 Dependencies installieren & Build

```bash
cd /home/deployer/apps/saivaromail

# Dependencies installieren
pnpm install --frozen-lockfile

# Build erstellen
pnpm build

# Prisma generieren & migrieren
cd apps/scc
npx prisma generate
npx prisma migrate deploy
cd ../..
```

### 4.8 Dateiberechtigungen setzen

```bash
cd /home/deployer/apps/saivaromail

# Ordner-Permissions
find . -type d -exec chmod 750 {} \;

# Datei-Permissions
find . -type f -exec chmod 640 {} \;

# .env Dateien nur für deployer
chmod 600 apps/*/.env.production
```

---

## Phase 5: PM2-Konfiguration (als deployer)

### 5.1 ecosystem.config.js erstellen

```bash
cat > /home/deployer/apps/saivaromail/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'saivaromail-mailclient',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      cwd: '/home/deployer/apps/saivaromail/apps/mailclient',
      user: 'deployer',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: '/var/log/pm2/saivaromail-mailclient-error.log',
      out_file: '/var/log/pm2/saivaromail-mailclient-out.log',
      time: true,
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    {
      name: 'saivaromail-scc-backend',
      script: 'dist/main.js',
      cwd: '/home/deployer/apps/saivaromail/apps/scc',
      user: 'deployer',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      error_file: '/var/log/pm2/saivaromail-scc-backend-error.log',
      out_file: '/var/log/pm2/saivaromail-scc-backend-out.log',
      time: true,
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    {
      name: 'saivaromail-scc-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3003',
      cwd: '/home/deployer/apps/saivaromail/apps/scc-frontend',
      user: 'deployer',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      error_file: '/var/log/pm2/saivaromail-scc-frontend-error.log',
      out_file: '/var/log/pm2/saivaromail-scc-frontend-out.log',
      time: true,
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
EOF
```

### 5.2 PM2-Log-Verzeichnis erstellen

```bash
sudo mkdir -p /var/log/pm2
sudo chown deployer:deployer /var/log/pm2
```

### 5.3 Logrotate für PM2

```bash
sudo tee /etc/logrotate.d/pm2 << 'EOF'
/var/log/pm2/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 deployer deployer
    sharedscripts
    postrotate
        sudo -u deployer pm2 reloadLogs
    endscript
}
EOF
```

### 5.4 PM2-Prozesse starten

```bash
cd /home/deployer/apps/saivaromail

# Prozesse starten
pm2 start ecosystem.config.js

# Status prüfen
pm2 status

# Logs anzeigen
pm2 logs

# PM2 speichern (für Autostart)
pm2 save
```

---

## Phase 6: NGINX-Konfiguration (als root)

### 6.1 NGINX installieren

```bash
sudo apt-get install -y nginx
```

### 6.2 Cache-Verzeichnis erstellen

```bash
sudo mkdir -p /var/cache/nginx/saivaro
sudo chown -R www-data:www-data /var/cache/nginx
```

### 6.3 NGINX-Konfiguration erstellen

```bash
sudo nano /etc/nginx/sites-available/saivaro.de
```

**Inhalt einfügen:**

```nginx
# Upstream-Definitionen
upstream saivaromail_mailclient {
    server localhost:3002;
    keepalive 64;
}

upstream saivaromail_scc_backend {
    server localhost:3100;
    keepalive 64;
}

upstream saivaromail_scc_frontend {
    server localhost:3003;
    keepalive 64;
}

# Cache-Zone
proxy_cache_path /var/cache/nginx/saivaro levels=1:2 keys_zone=saivaro_cache:10m max_size=100m inactive=60m use_temp_path=off;

# Rate Limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=50r/s;

# HTTP -> HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name www.saivaro.de saivaro.de;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.saivaro.de saivaro.de;

    # SSL Zertifikate (später mit Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/saivaro.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/saivaro.de/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/saivaro.de/chain.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Request Size Limits
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    # Hide version
    server_tokens off;

    # Logs
    access_log /var/log/nginx/saivaro.de_access.log;
    error_log /var/log/nginx/saivaro.de_error.log;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # API v1
    location /api/v1 {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://saivaromail_scc_backend/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_hide_header X-Powered-By;
        proxy_hide_header Server;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Legacy /api redirect
    location /api {
        return 301 $scheme://$host/api/v1$request_uri;
    }

    # SCC Frontend
    location /scc/ {
        proxy_pass http://saivaromail_scc_frontend/scc/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /scc {
        return 301 /scc/;
    }
    
    # SCC Static Files
    location ~ ^/scc/_next/static/ {
        proxy_pass http://saivaromail_scc_frontend;
        proxy_cache saivaro_cache;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable, max-age=31536000";
        expires 1y;
    }

    # Mailclient
    location / {
        limit_req zone=general_limit burst=100 nodelay;
        
        proxy_pass http://saivaromail_mailclient;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Mailclient Static Files
    location ~ ^/_next/static/ {
        proxy_pass http://saivaromail_mailclient;
        proxy_cache saivaro_cache;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable, max-age=31536000";
        expires 1y;
    }
    
    # Health Check
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
```

### 6.4 NGINX aktivieren

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/saivaro.de /etc/nginx/sites-enabled/

# Konfiguration testen (wird erstmal fehlschlagen wegen fehlendem SSL)
sudo nginx -t

# Default-Site deaktivieren (optional)
sudo rm /etc/nginx/sites-enabled/default
```

---

## Phase 7: SSL-Zertifikat (als root)

### 7.1 Certbot installieren

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 7.2 SSL-Zertifikat erstellen

```bash
# WICHTIG: Domain muss bereits auf Server zeigen!
# DNS A-Record für saivaro.de und www.saivaro.de auf Server-IP

# Zertifikat erstellen
sudo certbot --nginx -d saivaro.de -d www.saivaro.de

# E-Mail-Adresse angeben
# Terms akzeptieren
# Optional: E-Mail-Liste beitreten

# Auto-Renewal testen
sudo certbot renew --dry-run
```

### 7.3 NGINX neu laden

```bash
sudo systemctl reload nginx

# Status prüfen
sudo systemctl status nginx
```

---

## Phase 8: Backup-System (als deployer)

### 8.1 GPG-Schlüssel für Verschlüsselung

```bash
# GPG-Schlüssel generieren
gpg --gen-key

# Eingaben:
# Name: SAIVAROMAIL Backup
# Email: backup@saivaromail.local
# Passwort: SICHERES_PASSWORT (aufbewahren!)
```

### 8.2 Backup-Script erstellen

```bash
cat > /home/deployer/scripts/backup-saivaromail-db.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/home/deployer/backups/saivaromail"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
LOG_FILE="/home/deployer/logs/backup.log"

echo "[$(date)] Starting encrypted backup..." >> "$LOG_FILE"

# Datenbank Backup MIT VERSCHLÜSSELUNG
pg_dump -U saivaromail_user saivaromail_db | \
  gzip | \
  gpg --encrypt --recipient backup@saivaromail.local \
  > $BACKUP_DIR/saivaromail_db_$DATE.sql.gz.gpg

# Backup-Größe loggen
SIZE=$(du -h "$BACKUP_DIR/saivaromail_db_$DATE.sql.gz.gpg" | cut -f1)
echo "[$(date)] Backup completed: saivaromail_db_$DATE.sql.gz.gpg ($SIZE)" >> "$LOG_FILE"

# Alte Backups löschen (älter als 7 Tage)
find $BACKUP_DIR -name "*.sql.gz.gpg" -mtime +7 -delete

echo "[$(date)] Old backups cleaned" >> "$LOG_FILE"
EOF

chmod +x /home/deployer/scripts/backup-saivaromail-db.sh
```

### 8.3 Cronjob einrichten

```bash
# Crontab bearbeiten
crontab -e

# Folgende Zeile hinzufügen (täglich um 2 Uhr):
0 2 * * * /home/deployer/scripts/backup-saivaromail-db.sh
```

### 8.4 Backup-Restore (falls benötigt)

```bash
# Backup entschlüsseln und wiederherstellen
gpg --decrypt /home/deployer/backups/saivaromail/saivaromail_db_YYYYMMDD_HHMMSS.sql.gz.gpg | \
  gunzip | \
  psql -U saivaromail_user -d saivaromail_db
```

---

## Phase 9: Monitoring Setup

### 9.1 PM2 Plus (Optional, Kostenlos)

```bash
# Auf https://app.pm2.io registrieren
# Public & Private Key erhalten

# PM2 mit PM2 Plus verknüpfen
pm2 link <secret_key> <public_key>
```

### 9.2 Uptime Monitoring (Optional)

**UptimeRobot** (https://uptimerobot.com):
1. Account erstellen
2. Monitor hinzufügen: https://www.saivaro.de/health
3. Check-Interval: 5 Minuten
4. Alerts per E-Mail konfigurieren

---

## Phase 10: Testing & Verification

### 10.1 PM2-Status prüfen

```bash
pm2 status
pm2 logs --lines 50
```

### 10.2 Healthchecks

```bash
# Mailclient
curl http://localhost:3002

# SCC Backend
curl http://localhost:3100/health

# SCC Frontend
curl http://localhost:3003

# NGINX Health Endpoint
curl https://www.saivaro.de/health
```

### 10.3 SSL-Test

```bash
# Im Browser öffnen
https://www.saivaro.de

# SSL-Labs Test
https://www.ssllabs.com/ssltest/analyze.html?d=saivaro.de
```

### 10.4 Security-Check

```bash
# Firewall
sudo ufw status

# Fail2ban
sudo fail2ban-client status

# PM2 läuft als deployer (NICHT root)
ps aux | grep "saivaromail"

# Dateiberechtigungen
ls -la /home/deployer/apps/saivaromail/apps/*/. env.production
# Sollte: -rw------- deployer deployer
```

---

## Phase 11: Updates & Maintenance

### 11.1 Code-Update

```bash
# Als deployer
cd /home/deployer/apps/saivaromail

# Code aktualisieren
git pull

# Dependencies
pnpm install

# Build
pnpm build

# Prisma (falls Schema geändert)
cd apps/scc
npx prisma generate
npx prisma migrate deploy
cd ../..

# PM2 Zero-Downtime Reload
pm2 reload ecosystem.config.js
```

### 11.2 Dependency Security Scan

```bash
# Vor jedem Update prüfen
pnpm audit --audit-level=high
```

### 11.3 Log-Analyse

```bash
# PM2 Logs
pm2 logs saivaromail-mailclient --lines 100

# NGINX Logs
sudo tail -f /var/log/nginx/saivaro.de_access.log
sudo tail -f /var/log/nginx/saivaro.de_error.log

# PostgreSQL Logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Security Audit
sudo grep "Failed password" /var/log/auth.log | tail -20
```

---

## Sicherheits-Checkliste

Vor Go-Live alle Punkte abhaken:

- [ ] Deployer-User erstellt, NICHT root verwenden
- [ ] SSH gehärtet: Key-Only, Port 2222, PermitRootLogin no
- [ ] Kernel Hardening aktiv (sysctl.conf)
- [ ] Automatische Security Updates (unattended-upgrades)
- [ ] Firewall aktiv (UFW: 80, 443, 2222)
- [ ] Fail2ban aktiv (SSH + NGINX)
- [ ] PostgreSQL gehärtet (pg_hba.conf, SSL, Limits)
- [ ] Alle Secrets mit openssl generiert (32+ Zeichen)
- [ ] .gitignore vorhanden, .env NICHT in Git
- [ ] Verschlüsselte Backups (GPG)
- [ ] Security Headers in NGINX
- [ ] Helmet.js + CSRF im Backend aktiv
- [ ] Rate Limiting konfiguriert
- [ ] CORS restriktiv (nur www.saivaro.de)
- [ ] Cookie Security (httpOnly, secure, sameSite)
- [ ] Request Size Limits (10M)
- [ ] X-Powered-By entfernt
- [ ] Dateiberechtigungen: 750/640/600
- [ ] PM2 Log Rotation aktiv
- [ ] SSL-Zertifikat von Let's Encrypt
- [ ] Monitoring aktiv (PM2 Plus / UptimeRobot)

---

## Troubleshooting

### PM2-Prozess startet nicht
```bash
# Logs prüfen
pm2 logs saivaromail-mailclient --err

# .env.production vorhanden?
ls -la apps/mailclient/.env.production

# Port bereits belegt?
sudo lsof -i :3002
```

### NGINX 502 Bad Gateway
```bash
# PM2 läuft?
pm2 status

# Ports erreichbar?
curl http://localhost:3002
curl http://localhost:3100
curl http://localhost:3003

# NGINX Logs
sudo tail -f /var/log/nginx/saivaro.de_error.log
```

### Datenbank-Verbindung fehlschlägt
```bash
# PostgreSQL läuft?
sudo systemctl status postgresql

# Verbindung testen
psql -U saivaromail_user -d saivaromail_db -h localhost

# pg_hba.conf prüfen
sudo cat /etc/postgresql/15/main/pg_hba.conf
```

### SSH-Verbindung nach Härtung verloren
```bash
# Falls noch root-Session offen:
sudo nano /etc/ssh/sshd_config
# PermitRootLogin yes (temporär)
# PasswordAuthentication yes (temporär)
sudo systemctl restart sshd

# Neue deployer SSH-Keys einrichten
# Dann wieder härten
```

---

## Support & Kontakt

Bei Fragen oder Problemen:
- Plan-Datei: `.cursor/plans/hetzner_server_deployment_*.plan.md`
- Logs: `/home/deployer/logs/`
- PM2 Logs: `/var/log/pm2/`
- NGINX Logs: `/var/log/nginx/`

---

**Ende des Deployment Guide**

Viel Erfolg beim Deployment! 🚀
