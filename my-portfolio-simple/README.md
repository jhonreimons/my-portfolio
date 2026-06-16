# My Portfolio

Simple DevOps portfolio website using:

- HTML
- Tailwind CSS CDN
- Node.js Express
- PM2 for production process

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:3000
```

## Deploy on EC2

```bash
cd /var/www/my-portfolio
git pull origin main
npm install --omit=dev
pm2 restart my-portfolio
```
