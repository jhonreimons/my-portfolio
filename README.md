# My Portfolio CRUD + About + Photo + Animation

Dynamic portfolio app using:

- Express
- SQLite
- Express Session
- bcryptjs
- multer
- HTML + Tailwind CDN

Dynamic/editable data:

- Hero text
- About Me
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

Default login from `.env`:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
```

## Production note

Use persistent paths outside Git repo:

```text
DB_PATH=/var/lib/portfolio/portfolio.db
UPLOAD_DIR=/var/lib/portfolio/uploads
```
