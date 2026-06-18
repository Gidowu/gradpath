# Deploy GradPath on Oracle Cloud (Always Free)

Oracle Cloud's **Always Free** tier gives you a full Linux server that never expires. Here's how to get GradPath running on it so your friends can access it from anywhere.

---

## Step 1: Create an Oracle Cloud Account

1. Go to **https://cloud.oracle.com** and click **Sign Up**
2. Use your real name and email — you'll verify both
3. You'll need a credit/debit card for verification, but **you won't be charged** on the Always Free tier
4. Pick your **Home Region** — choose the one closest to you (e.g., US East Ashburn, US West Phoenix). This can't be changed later.
5. Wait for the account to be provisioned (can take a few minutes)

---

## Step 2: Create an Always Free VM

1. Log into the **Oracle Cloud Console** at https://cloud.oracle.com
2. Click **Create a VM instance** (or go to Compute → Instances → Create Instance)
3. Configure it like this:

| Setting | Value |
|---------|-------|
| **Name** | `gradpath-server` |
| **Image** | Oracle Linux 8 (or Ubuntu 22.04 — either works, guide uses Ubuntu) |
| **Shape** | Click "Change Shape" → **Ampere** (ARM) → **VM.Standard.A1.Flex** → 1 OCPU, 6 GB RAM |
| **Networking** | Use the default VCN or create one. Make sure "Assign a public IPv4 address" is **YES** |
| **SSH Key** | Click "Generate a key pair" and **download both keys** (save them somewhere safe!) |

4. Click **Create** — wait 2-3 minutes for it to start
5. Once running, copy the **Public IP Address** from the instance details page (e.g., `129.213.xx.xx`)

> **Tip:** If the ARM shape says "Out of capacity," try a different availability domain, or use the AMD **VM.Standard.E2.1.Micro** shape instead (1 GB RAM, still Always Free).

---

## Step 3: Open Ports on Oracle Cloud

Oracle Cloud blocks most ports by default. You need to open ports 80 (HTTP) and 443 (HTTPS).

1. From your instance page, click the **Subnet** link under "Primary VNIC"
2. Click the **Security List** (usually "Default Security List for ...")
3. Click **Add Ingress Rules** and add these two rules:

**Rule 1 — HTTP:**

| Field | Value |
|-------|-------|
| Source CIDR | `0.0.0.0/0` |
| Destination Port Range | `80` |
| Description | HTTP |

**Rule 2 — HTTPS:**

| Field | Value |
|-------|-------|
| Source CIDR | `0.0.0.0/0` |
| Destination Port Range | `443` |
| Description | HTTPS |

---

## Step 4: SSH into Your Server

Open Terminal on your Mac:

```bash
# Make the key file secure (required)
chmod 400 ~/Downloads/ssh-key-*.key

# Connect (replace with YOUR public IP)
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

If you chose Oracle Linux instead of Ubuntu, the username is `opc` instead of `ubuntu`.

---

## Step 5: Install Everything on the Server

Copy and paste these commands one section at a time:

### Update the system
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should show v20.x
```

### Install MariaDB
```bash
sudo apt install -y mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

### Secure MariaDB and create the database
```bash
# Set up root password (press Enter for current password, then set a new one)
sudo mariadb-secure-installation

# Create the gradpath database and user
sudo mariadb -e "
  CREATE DATABASE IF NOT EXISTS gradpath;
  CREATE USER IF NOT EXISTS 'gradpath'@'localhost' IDENTIFIED BY 'PickAStrongPasswordHere';
  GRANT ALL PRIVILEGES ON gradpath.* TO 'gradpath'@'localhost';
  FLUSH PRIVILEGES;
"
```

### Install Nginx (reverse proxy)
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### Install PM2 (keeps your app running 24/7)
```bash
sudo npm install -g pm2
```

---

## Step 6: Deploy GradPath

### Clone your repo
```bash
cd ~
git clone https://github.com/Gidowu/gradpath.git
cd gradpath
```

### Install server dependencies
```bash
cd server
npm install
cd ..
```

### Create the .env file
```bash
cat > server/.env << 'EOF'
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=gradpath
DB_PASSWORD=PickAStrongPasswordHere
DB_NAME=gradpath
SESSION_SECRET=pick-a-long-random-string-here-abc123xyz
PORT=4151
EOF
```

**Important:** Replace `PickAStrongPasswordHere` with whatever password you set in Step 5, and change the SESSION_SECRET to something random and unique.

### Start the app with PM2
```bash
cd ~/gradpath
pm2 start server/index.js --name gradpath
pm2 save
pm2 startup   # follow the command it prints to auto-start on reboot
```

Check it's running:
```bash
pm2 status
curl http://localhost:4151/api/status
# Should see: {"ok":true,"data":{"status":"running","database":"connected"}}
```

---

## Step 7: Set Up Nginx Reverse Proxy

This lets people visit your server on port 80 (normal HTTP) instead of port 4151.

```bash
sudo tee /etc/nginx/sites-available/gradpath << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:4151;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/gradpath /etc/nginx/sites-enabled/gradpath
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### Open the firewall on the VM itself
Oracle Linux / Ubuntu also has a local firewall:

```bash
# Ubuntu (iptables)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# If netfilter-persistent isn't installed:
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## Step 8: Test It!

From your phone or any computer, open a browser and go to:

```
http://YOUR_PUBLIC_IP
```

Replace `YOUR_PUBLIC_IP` with the IP address from Step 2. You should see GradPath's login page! Share this address with your friends.

---

## Optional: Get a Free Domain Name

A bare IP address works, but a domain name looks better. Free options:

### Option A: Freenom alternatives (free subdomains)
- **https://freedns.afraid.org** — free subdomain like `gradpath.mooo.com`
- **https://www.duckdns.org** — free subdomain like `gradpath.duckdns.org`
- **https://www.noip.com** — free hostname (requires renewal every 30 days)

### Option B: Free .me domain from GitHub Education
If you have a GitHub Student Developer Pack, you get a free `.me` domain from Namecheap for 1 year.

Once you have a domain, point it to your Oracle Cloud IP address (create an **A record** pointing to your public IP).

---

## Optional: Add Free HTTPS (SSL)

Once you have a domain name pointed to your server:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically configure Nginx for HTTPS and set up auto-renewal. This gives you the padlock icon in browsers.

---

## Useful Commands

```bash
# Check app status
pm2 status

# View app logs (live)
pm2 logs gradpath

# Restart after code changes
cd ~/gradpath && git pull && pm2 restart gradpath

# Check database
sudo mariadb gradpath -e "SHOW TABLES;"

# Check Nginx status
sudo systemctl status nginx
```

---

## Updating GradPath

When you push new code to GitHub:

```bash
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
cd ~/gradpath
git pull
cd client && npx vite build && cd ..
pm2 restart gradpath
```

---

## Troubleshooting

**"Out of capacity" error when creating VM:**
ARM instances are popular. Try a different availability domain, try again later (early morning works best), or use the AMD VM.Standard.E2.1.Micro shape instead.

**Can't connect to the IP in browser:**
1. Check security list rules (Step 3)
2. Check iptables firewall (Step 7)
3. Check Nginx is running: `sudo systemctl status nginx`
4. Check app is running: `pm2 status`

**Database connection error:**
Check your .env credentials match what you set in `sudo mariadb-secure-installation`. Test with: `mariadb -u gradpath -p gradpath`

**App crashes on start:**
Check logs: `pm2 logs gradpath --lines 50`
