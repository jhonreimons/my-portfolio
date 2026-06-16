# My Portfolio Full Fixed

Perbaikan utama:

- `/admin.html` dibuat explicit route di Express agar tidak fallback ke `index.html`.
- Hero highlight `DevOps precision.` tidak lagi dipecah per kata, sehingga tidak hilang.
- Contact default menambahkan Phone jika belum ada di database.
- Contact value bisa di-select manual oleh user.
- Redirect link contact memakai tombol icon panah `↗`, bukan tulisan "Open".
- Foto memakai `object-contain`, jadi tidak crop setelah upload.
- Mobile layout dibuat tidak overflow.

## Run locally

```bash
cp .env.example .env
npm install
npm start
```

Open:

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/admin.html
```

## Production

```bash
cd /var/www/my-portfolio
git pull origin main
npm ci --omit=dev
pm2 restart my-portfolio --update-env
```

Persistent data:

```text
/var/lib/portfolio/portfolio.db
/var/lib/portfolio/uploads
```
