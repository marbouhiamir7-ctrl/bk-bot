# BK BOT — Free Hosting Guide (Oracle Cloud + DuckDNS)

## Step 1: Create Oracle Cloud Account (FREE)
1. Go to **cloud.oracle.com**
2. Click **Start for Free**
3. Sign up (needs credit card for verification, but you won't be charged)
4. Create a **VM.Standard.A1.Flex** instance (Always Free tier)
   - Choose **Ubuntu 22.04** as the image
   - Select **ARM** shape (1-4 OCPUs, up to 24GB RAM)
   - Create SSH key or upload your own
5. Note down your **Public IP** and **SSH key**

## Step 2: Connect to Your VPS
```bash
# On Windows, use PowerShell or PuTTY
ssh -i your-key.pem ubuntu@YOUR_PUBLIC_IP
```

## Step 3: Upload Project Files
```bash
# From your Windows machine (run in PowerShell)
scp -i your-key.pem -r "C:\Users\Administrator\Desktop\discord bot BAKTIRIYA TEAM\deploy\*" ubuntu@YOUR_PUBLIC_IP:/tmp/
```

Or use GitHub:
```bash
# On your VPS:
cd /var/www
git clone https://github.com/YOUR_USERNAME/bkbot.git
```

## Step 4: Run Deploy Script
```bash
# On your VPS:
cd /tmp
bash deploy.sh
```
Follow the prompts — enter your domain (or press Enter for IP).

## Step 5: Free Domain (DuckDNS)
1. Go to **duckdns.org**
2. Sign in with GitHub/Google
3. Create a domain: `baktiriya.duckdns.org`
4. Point it to your VPS IP
5. On your VPS, update DNS:
```bash
curl "https://www.duckdns.org/update?domains=baktiriya&token=YOUR_TOKEN&ip=YOUR_VPS_IP"
```

## Step 6: SSL Certificate
```bash
sudo certbot --nginx -d baktiriya.duckdns.org
```

## Step 7: Update Discord Developer Portal
1. Go to **discord.com/developers/applications**
2. Click **BK BOT** → **OAuth2** → **Redirects**
3. Add: `https://baktiriya.duckdns.org/callback`
4. Click **Save**

## Step 8: Update .env on VPS
```bash
sudo nano /var/www/bkbot/.env
# Change REDIRECT_URI to: https://baktiriya.duckdns.org/callback
# Save with Ctrl+O, exit with Ctrl+X

pm2 restart all
```

## Done! Your bot is live at:
- **Login:** https://baktiriya.duckdns.org/login.html
- **Dashboard:** https://baktiriya.duckdns.org/dashboard.html

## Useful Commands:
```bash
pm2 status          # Check bot status
pm2 logs            # View live logs
pm2 restart all     # Restart everything
pm2 stop all        # Stop everything
```

## Auto-start on reboot:
```bash
pm2 save
pm2 startup
```
