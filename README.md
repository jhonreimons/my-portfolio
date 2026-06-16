# Portfolio Mobile Fix

Replace your existing `public/index.html` with the file inside this ZIP.

This update fixes:
- mobile overflow layout
- hero title size on mobile
- photo no longer crops after upload (`object-contain`)
- smoother modern animations
- contact cards include Copy and Open buttons

After replacing the file:

```bash
git add public/index.html
git commit -m "fix mobile layout and contact copy actions"
git push origin main
```

On server:

```bash
cd /var/www/my-portfolio
git pull origin main
pm2 restart my-portfolio
```
