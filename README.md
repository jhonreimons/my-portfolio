# My Portfolio CRUD + Profile Photo

Simple modern dynamic portfolio app using Express, SQLite, admin login, and photo upload.

Dynamic data:

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
