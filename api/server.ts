import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

// In development (tsx), we are in an ESM environment. 
// In production (esbuild cjs), we are in a CJS environment.
// Using path.resolve() works for both as long as the server is started from the project root.
const __dirname = path.resolve();

const getAdminPassword = () => {
  const envPass = (process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
  if (envPass && envPass !== 'supersecretpassword') return envPass;
  return 'Tempest2271';
};

const ADMIN_PASSWORD = getAdminPassword();

async function startServer() {
  const app = express();
  const port = 3000;

  // Ensure uploads directory exists
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  // In-memory or simple file-based storage for metadata
  interface FileMetadata {
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadDate: number;
    type: 'file' | 'folder';
    parentId: string | null;
  }

  const metadataFilePath = path.join(__dirname, 'metadata.json_db');
  const settingsFilePath = path.join(__dirname, 'settings.json_db');
  let filesMetadata: Record<string, FileMetadata> = {};
  let settings = { backgroundImage: '' };

  if (fs.existsSync(metadataFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));
      // Basic migration for existing records
      Object.keys(data).forEach(id => {
        if (!data[id].type) data[id].type = 'file';
        if (data[id].parentId === undefined) data[id].parentId = null;
      });
      filesMetadata = data;
    } catch (e) {
      filesMetadata = {};
    }
  }

  if (fs.existsSync(settingsFilePath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
    } catch (e) {
      settings = { backgroundImage: '' };
    }
  }

  const saveMetadata = () => {
    fs.writeFileSync(metadataFilePath, JSON.stringify(filesMetadata));
  };

  const saveSettings = () => {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings));
  };

  // Multer config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueId = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    },
  });

  const upload = multer({ storage });

  app.use(express.json());

  const clean = (str: any) => (str || '').toString().trim().replace(/[\u200B-\u200D\uFEFF\s]/g, '');

  // Admin Middleware
  const isAdmin = (req: express.Request) => {
    const provided = clean(req.headers['x-admin-password']);
    const expected = clean(ADMIN_PASSWORD);
    const magic = 'Tempest2271_Admin_99';
    if (provided && (provided === 'Tempest2271' || provided === expected || provided === magic)) return true;
    return false;
  };

  // API Routes
  app.get('/api/settings', (req, res) => {
    res.json(settings);
  });

  app.post('/api/settings/background', (req, res, next) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }, upload.single('background'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    
    // We can use the download endpoint to serve the background too
    const id = path.parse(req.file.filename).name;
    const metadata: FileMetadata = {
      id,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadDate: Date.now(),
      type: 'file',
      parentId: 'system' // mark it as system to avoid listing in root
    };

    filesMetadata[id] = metadata;
    saveMetadata();

    settings.backgroundImage = `/download/${id}`;
    saveSettings();

    res.json({ success: true, url: settings.backgroundImage });
  });

  app.post('/api/settings/reset-background', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
    settings.backgroundImage = '';
    saveSettings();
    res.json({ success: true });
  });

  app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    
    // User requested emergency path & Magic Link
    if (password === 'Tempest2271' || password === 'Tempest2271_Admin_99') return res.status(200).json({ success: true });

    const provided = clean(password);
    const expected = clean(ADMIN_PASSWORD);

    if (provided && (provided === expected || provided === 'Tempest2271' || provided === 'Tempest2271_Admin_99')) {
      res.json({ success: true });
    } else {
      console.log(`[Admin] Login attempt failed.`);
      res.status(401).json({ error: 'Unauthorized' });
    }
  });

  app.post('/api/upload', (req, res, next) => {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'Only admins can upload' });
    }
    next();
  }, upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { parentId } = req.body;
    const id = path.parse(req.file.filename).name;
    const metadata: FileMetadata = {
      id,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadDate: Date.now(),
      type: 'file',
      parentId: parentId || null
    };

    filesMetadata[id] = metadata;
    saveMetadata();

    res.json({
      success: true,
      file: metadata,
      url: `/download/${id}`,
    });
  });

  app.post('/api/create-folder', (req, res) => {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'Only admins can create folders' });
    }

    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    const id = crypto.randomBytes(8).toString('hex');
    const metadata: FileMetadata = {
      id,
      originalName: name,
      size: 0,
      mimeType: 'application/x-directory',
      uploadDate: Date.now(),
      type: 'folder',
      parentId: parentId || null
    };

    filesMetadata[id] = metadata;
    saveMetadata();

    res.json({ success: true, folder: metadata });
  });

  app.delete('/api/delete/:id', (req, res) => {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const metadata = filesMetadata[id];

    if (!metadata) {
      return res.status(404).json({ error: 'Not found' });
    }

    const deleteItem = (itemId: string) => {
      const item = filesMetadata[itemId];
      if (!item) return;

      if (item.type === 'folder') {
        // Find children
        const children = Object.values(filesMetadata).filter(f => f.parentId === itemId);
        children.forEach(child => deleteItem(child.id));
        delete filesMetadata[itemId];
      } else {
        // Delete file from disk
        const files = fs.readdirSync(uploadDir);
        const actualFile = files.find(f => f.startsWith(itemId));
        if (actualFile) {
          const filePath = path.join(uploadDir, actualFile);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        delete filesMetadata[itemId];
      }
    };

    try {
      deleteItem(id);
      saveMetadata();
      res.json({ success: true });
    } catch (err) {
      console.error('Delete failed', err);
      res.status(500).json({ error: 'Delete operation failed' });
    }
  });

  app.get('/api/files', (req, res) => {
    const { parentId } = req.query;
    const pid = parentId === 'null' || !parentId ? null : parentId as string;
    
    const list = Object.values(filesMetadata)
      .filter(f => f.parentId === pid)
      .sort((a, b) => {
        // Folders first, then by date
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return b.uploadDate - a.uploadDate;
      });
    res.json(list);
  });

  app.get('/api/file/:id', (req, res) => {
    const metadata = filesMetadata[req.params.id];
    if (!metadata) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(metadata);
  });

  // Download endpoint
  app.get('/download/:id', (req, res) => {
    const id = req.params.id;
    const metadata = filesMetadata[id];

    if (!metadata) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(uploadDir);
    const actualFile = files.find(f => f.startsWith(id));

    if (!actualFile) {
      return res.status(404).send('File missing on disk');
    }

    const filePath = path.join(uploadDir, actualFile);
    res.download(filePath, metadata.originalName);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
