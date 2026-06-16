# My Portfolio Polished

Dynamic portfolio app using:

- Express
- SQLite
- Express Session
- bcryptjs
- multer
- HTML + Tailwind CDN

Dynamic data:

- Hero and About content
- Profile photo
- Skills
- Experience
- Contact

## Run locally

```bash
cp .env.example .env
npm install
npm start
```

Open:

```text
http://127.0.0.1:3000
```

Admin page:

```text
http://127.0.0.1:3000/admin.html
```

## Production note

Use persistent paths outside Git repo:

```text
DB_PATH=/var/lib/portfolio/portfolio.db
UPLOAD_DIR=/var/lib/portfolio/uploads
```
