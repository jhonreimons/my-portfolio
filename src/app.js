require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { initDatabase, run, get, all } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "../uploads");
const publicDir = path.join(__dirname, "../public");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function filename(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = `profile-${Date.now()}${extension}`;
    cb(null, safeName);
  }
});

function fileFilter(req, file, cb) {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "portfolio.sid",
    secret: process.env.SESSION_SECRET || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: "Unauthorized. Please login first." });
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.join(",");
  return String(tags || "");
}

function parseTags(tags) {
  if (!tags) return [];
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function deleteFileIfExists(publicPath) {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;

  const filename = path.basename(publicPath);
  const fullPath = path.join(uploadDir, filename);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

async function getSiteContentObject() {
  const rows = await all("SELECT key, value FROM site_content");
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "my-portfolio",
    timestamp: new Date().toISOString()
  });
});

// Explicit routes so /admin.html will not fall back to index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/admin", (req, res) => {
  res.redirect("/admin.html");
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

// Auth
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await get("SELECT * FROM users WHERE username = ?", [username]);

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    req.session.user = {
      id: user.id,
      username: user.username
    };

    return res.json({ message: "Login successful.", user: req.session.user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login failed." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("portfolio.sid");
    res.json({ message: "Logout successful." });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, user: req.session.user });
});

// Public portfolio data
app.get("/api/portfolio", async (req, res) => {
  try {
    const content = await getSiteContentObject();
    const skills = await all("SELECT * FROM skills ORDER BY sort_order ASC, id ASC");
    const experiences = await all("SELECT * FROM experiences ORDER BY sort_order ASC, id ASC");
    const contacts = await all("SELECT * FROM contacts ORDER BY sort_order ASC, id ASC");
    const photo = await get("SELECT * FROM profile_photo WHERE id = 1");

    return res.json({
      content,
      profilePhoto: photo || null,
      skills,
      experiences: experiences.map((item) => ({
        ...item,
        tags: parseTags(item.tags)
      })),
      contacts
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load portfolio data." });
  }
});

// Site content CRUD
app.get("/api/admin/content", requireAuth, async (req, res) => {
  const content = await getSiteContentObject();
  res.json(content);
});

app.put("/api/admin/content", requireAuth, async (req, res) => {
  const allowedKeys = [
    "hero_badge",
    "hero_title_line1",
    "hero_title_highlight",
    "hero_description",
    "hero_primary_button",
    "hero_secondary_button",
    "about_label",
    "about_title",
    "about_body",
    "marquee_items"
  ];

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      await run(
        `INSERT INTO site_content (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, String(req.body[key] || "")]
      );
    }
  }

  const content = await getSiteContentObject();
  res.json({ message: "Content updated.", content });
});

// Photo CRUD
app.get("/api/admin/photo", requireAuth, async (req, res) => {
  const photo = await get("SELECT * FROM profile_photo WHERE id = 1");
  res.json(photo || {});
});

app.post("/api/admin/photo", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const existing = await get("SELECT * FROM profile_photo WHERE id = 1");

    let imagePath = existing ? existing.image_path : null;
    let originalName = existing ? existing.original_name : null;

    if (req.file) {
      if (existing && existing.image_path) {
        deleteFileIfExists(existing.image_path);
      }

      imagePath = `/uploads/${req.file.filename}`;
      originalName = req.file.originalname;
    }

    await run(
      `INSERT INTO profile_photo (id, image_path, original_name, alt_text, headline, updated_at)
       VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
        image_path = excluded.image_path,
        original_name = excluded.original_name,
        alt_text = excluded.alt_text,
        headline = excluded.headline,
        updated_at = CURRENT_TIMESTAMP`,
      [
        imagePath,
        originalName,
        req.body.alt_text || "Jhon Reimon Siagian",
        req.body.headline || "DevOps Engineer"
      ]
    );

    const photo = await get("SELECT * FROM profile_photo WHERE id = 1");
    res.json({ message: "Profile photo updated.", photo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update profile photo." });
  }
});

app.delete("/api/admin/photo", requireAuth, async (req, res) => {
  const existing = await get("SELECT * FROM profile_photo WHERE id = 1");

  if (existing && existing.image_path) {
    deleteFileIfExists(existing.image_path);
  }

  await run(
    "UPDATE profile_photo SET image_path = NULL, original_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
  );

  res.json({ message: "Profile photo deleted." });
});

// Skills CRUD
app.get("/api/admin/skills", requireAuth, async (req, res) => {
  const rows = await all("SELECT * FROM skills ORDER BY sort_order ASC, id ASC");
  res.json(rows);
});

app.post("/api/admin/skills", requireAuth, async (req, res) => {
  const { name, category, level, description, sort_order } = req.body;

  const result = await run(
    "INSERT INTO skills (name, category, level, description, sort_order) VALUES (?, ?, ?, ?, ?)",
    [name, category, level, description, Number(sort_order || 0)]
  );

  res.status(201).json({ id: result.id, message: "Skill created." });
});

app.put("/api/admin/skills/:id", requireAuth, async (req, res) => {
  const { name, category, level, description, sort_order } = req.body;

  await run(
    "UPDATE skills SET name = ?, category = ?, level = ?, description = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, category, level, description, Number(sort_order || 0), req.params.id]
  );

  res.json({ message: "Skill updated." });
});

app.delete("/api/admin/skills/:id", requireAuth, async (req, res) => {
  await run("DELETE FROM skills WHERE id = ?", [req.params.id]);
  res.json({ message: "Skill deleted." });
});

// Experiences CRUD
app.get("/api/admin/experiences", requireAuth, async (req, res) => {
  const rows = await all("SELECT * FROM experiences ORDER BY sort_order ASC, id ASC");
  res.json(rows.map((row) => ({ ...row, tags: parseTags(row.tags) })));
});

app.post("/api/admin/experiences", requireAuth, async (req, res) => {
  const { title, company, period, description, tags, sort_order } = req.body;

  const result = await run(
    "INSERT INTO experiences (title, company, period, description, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    [title, company, period, description, normalizeTags(tags), Number(sort_order || 0)]
  );

  res.status(201).json({ id: result.id, message: "Experience created." });
});

app.put("/api/admin/experiences/:id", requireAuth, async (req, res) => {
  const { title, company, period, description, tags, sort_order } = req.body;

  await run(
    "UPDATE experiences SET title = ?, company = ?, period = ?, description = ?, tags = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [title, company, period, description, normalizeTags(tags), Number(sort_order || 0), req.params.id]
  );

  res.json({ message: "Experience updated." });
});

app.delete("/api/admin/experiences/:id", requireAuth, async (req, res) => {
  await run("DELETE FROM experiences WHERE id = ?", [req.params.id]);
  res.json({ message: "Experience deleted." });
});

// Contacts CRUD
app.get("/api/admin/contacts", requireAuth, async (req, res) => {
  const rows = await all("SELECT * FROM contacts ORDER BY sort_order ASC, id ASC");
  res.json(rows);
});

app.post("/api/admin/contacts", requireAuth, async (req, res) => {
  const { type, label, value, url, sort_order } = req.body;

  const result = await run(
    "INSERT INTO contacts (type, label, value, url, sort_order) VALUES (?, ?, ?, ?, ?)",
    [type, label, value, url, Number(sort_order || 0)]
  );

  res.status(201).json({ id: result.id, message: "Contact created." });
});

app.put("/api/admin/contacts/:id", requireAuth, async (req, res) => {
  const { type, label, value, url, sort_order } = req.body;

  await run(
    "UPDATE contacts SET type = ?, label = ?, value = ?, url = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [type, label, value, url, Number(sort_order || 0), req.params.id]
  );

  res.json({ message: "Contact updated." });
});

app.delete("/api/admin/contacts/:id", requireAuth, async (req, res) => {
  await run("DELETE FROM contacts WHERE id = ?", [req.params.id]);
  res.json({ message: "Contact deleted." });
});

// Fallback only for public site, after all API/admin routes
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Error handler
app.use((error, req, res, next) => {
  if (error) {
    return res.status(400).json({ message: error.message || "Request failed." });
  }
  next();
});

initDatabase()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Portfolio app running on http://127.0.0.1:${PORT}`);
      console.log(`Uploads directory: ${uploadDir}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
