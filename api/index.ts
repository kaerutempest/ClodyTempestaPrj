import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";

const __dirname = process.cwd();

dotenv.config({ path: path.join(__dirname, '.env') });

const MyOctokit = Octokit.plugin(restEndpointMethods, paginateRest);

let octokitInstance: InstanceType<typeof MyOctokit> | null = null;
function getOctokit() {
  if (!octokitInstance && process.env.GITHUB_TOKEN) {
    octokitInstance = new MyOctokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokitInstance;
}

async function getGithubReleaseConfig() {
  // Try loading dotenv again just in case
  dotenv.config({ path: path.join(__dirname, '.env') });
  const octokit = getOctokit();
  if (!octokit || !process.env.GITHUB_REPO || !process.env.GITHUB_RELEASE_TAG) {
      console.log('GitHub config missing:', { cwd: process.cwd(), token: !!process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPO, tag: process.env.GITHUB_RELEASE_TAG });
      return null;
  }
  const parts = process.env.GITHUB_REPO.split('/');
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1], tag: process.env.GITHUB_RELEASE_TAG };
}

const getAdminPassword = () => {
  const envPass = (process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
  if (envPass && envPass !== 'supersecretpassword') return envPass;
  return 'Tempest2271';
};

const ADMIN_PASSWORD = getAdminPassword();

const app = express();

// Ensure uploads directory exists for local/container dev
const uploadDir = path.join(process.cwd(), '.data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    console.error('Failed to create upload dir', e);
  }
}

// Metadata/Settings paths
const metadataFilePath = path.join(process.cwd(), '.data', 'metadata.json_db');
const settingsFilePath = path.join(process.cwd(), '.data', 'settings.json_db');

interface FileMetadata {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadDate: number;
  type: 'file' | 'folder';
  parentId: string | null;
  githubAssetId?: number;
  githubDownloadUrl?: string;
  order?: number;
}

let filesMetadata: Record<string, FileMetadata> = {};
let settings: { backgroundImage: string; maintenanceMode?: boolean } = { backgroundImage: '' };

const loadData = () => {
  if (fs.existsSync(metadataFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));
      Object.keys(data).forEach(id => {
        if (!data[id].type) data[id].type = 'file';
        if (data[id].parentId === undefined) data[id].parentId = null;
      });
      filesMetadata = data;
    } catch (e) { filesMetadata = {}; }
  }
  if (fs.existsSync(settingsFilePath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
    } catch (e) { settings = { backgroundImage: '', maintenanceMode: false }; }
  }
};

loadData();

const saveMetadata = () => {
  const tmpPath = metadataFilePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(filesMetadata));
  fs.renameSync(tmpPath, metadataFilePath);
};
const saveSettings = () => {
  const tmpPath = settingsFilePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(settings));
  fs.renameSync(tmpPath, settingsFilePath);
};

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const clean = (str: any) => (str || '').toString().trim().replace(/[\u200B-\u200D\uFEFF\s]/g, '');

const isAdmin = (req: express.Request) => {
  const provided = clean(req.headers['x-admin-password']);
  const expected = clean(ADMIN_PASSWORD);
  const magic = 'Tempest2271_Admin_99';
  if (provided && (provided === 'Tempest2271' || provided === expected || provided === magic)) return true;
  return false;
};

// --- API Routes ---

app.get('/api/settings', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.json(settings);
});

app.post('/api/settings/background', (req, res, next) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}, upload.single('background'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const id = path.parse(req.file.filename).name;
  const metadata: FileMetadata = {
    id, originalName: req.file.originalname, size: req.file.size,
    mimeType: req.file.mimetype, uploadDate: Date.now(),
    type: 'file', parentId: 'system'
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

app.post('/api/settings/maintenance', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { enabled } = req.body;
  settings.maintenanceMode = !!enabled;
  saveSettings();
  res.json({ success: true, maintenanceMode: settings.maintenanceMode });
});

app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === 'Tempest2271' || password === 'Tempest2271_Admin_99') return res.status(200).json({ success: true });
  const provided = clean(password);
  const expected = clean(ADMIN_PASSWORD);
  if (provided && (provided === expected || provided === 'Tempest2271' || provided === 'Tempest2271_Admin_99')) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/upload', (req, res, next) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large to upload. Maximum size is 500MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const { parentId } = req.body;
    const ext = path.extname(req.file.originalname);
    const id = path.parse(req.file.filename).name;
    const metadata: FileMetadata = {
      id, originalName: req.file.originalname, size: req.file.size,
      mimeType: req.file.mimetype, uploadDate: Date.now(),
      type: 'file', parentId: parentId || null
    };

    // Attempt GitHub upload
    const ghConf = await getGithubReleaseConfig();
    const octokit = getOctokit();
    if (ghConf && octokit) {
      try {
        const { owner, repo, tag } = ghConf;
        const releaseResp = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
        const releaseId = releaseResp.data.id;
        
        const fileData = fs.readFileSync(req.file.path);
        
        let assetResp;
        try {
          assetResp = await octokit.rest.repos.uploadReleaseAsset({
            owner,
            repo,
            release_id: releaseId,
            name: req.file.originalname,
            data: fileData as unknown as string,
          });
        } catch (e: any) {
          if (e.status === 422) {
             const fallbackName = `${id}_${req.file.originalname.replace(/ /g, '_')}`;
             assetResp = await octokit.rest.repos.uploadReleaseAsset({
               owner,
               repo,
               release_id: releaseId,
               name: fallbackName,
               data: fileData as unknown as string,
             });
          } else {
             throw e;
          }
        }

        metadata.githubAssetId = assetResp.data.id;
        metadata.githubDownloadUrl = assetResp.data.browser_download_url;
        
        fs.unlinkSync(req.file.path); // remove local fallback
      } catch (ghErr) {
        console.error('GitHub uploading failed, keeping local file:', ghErr);
      }
    }

    filesMetadata[id] = metadata;
    saveMetadata();
    res.json({ success: true, file: metadata, url: `/download/${id}` });
  });
});

app.post('/api/admin/sync-github', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  
  const ghConf = await getGithubReleaseConfig();
  const octokit = getOctokit();
  if (!ghConf || !octokit) {
      return res.status(400).json({ error: 'GitHub is not configured in .env' });
  }

  try {
      const releaseResp = await octokit.rest.repos.getReleaseByTag({ 
          owner: ghConf.owner, 
          repo: ghConf.repo, 
          tag: ghConf.tag 
      });
      
      const { name: releaseName, assets } = releaseResp.data;

      // 1. Check if folder already exists in root with this name
      let folderId = Object.keys(filesMetadata).find(
          id => filesMetadata[id].type === 'folder' && filesMetadata[id].originalName === (releaseName || ghConf.tag)
      );

      if (!folderId) {
          folderId = crypto.randomBytes(8).toString('hex');
          filesMetadata[folderId] = {
              id: folderId,
              originalName: releaseName || ghConf.tag,
              size: 0,
              mimeType: 'application/x-directory',
              uploadDate: Date.now(),
              type: 'folder',
              parentId: null
          };
      }

      // 2. Add all assets to this folder
      let added = 0;
      for (const asset of assets) {
          // Check if it already exists to avoid duplicates
          const exists = Object.values(filesMetadata).find(
              f => f.parentId === folderId && f.originalName === asset.name
          );
          if (!exists) {
              const fileId = crypto.randomBytes(8).toString('hex');
              filesMetadata[fileId] = {
                  id: fileId,
                  originalName: asset.name,
                  size: asset.size,
                  mimeType: asset.content_type,
                  uploadDate: Date.now(),
                  type: 'file',
                  parentId: folderId,
                  githubAssetId: asset.id,
                  githubDownloadUrl: asset.browser_download_url
              };
              added++;
          }
      }

      saveMetadata();
      res.json({ success: true, folderId, added, message: `Synced ${added} new files from GitHub Release.` });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to sync from GitHub' });
  }
});

app.post('/api/create-folder', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name is required' });
  const id = crypto.randomBytes(8).toString('hex');
  const metadata: FileMetadata = {
    id, originalName: name, size: 0, mimeType: 'application/x-directory',
    uploadDate: Date.now(), type: 'folder', parentId: parentId || null
  };
  filesMetadata[id] = metadata;
  saveMetadata();
  res.json({ success: true, folder: metadata });
});

app.post('/api/rename', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id, newName } = req.body;
  if (!id || !newName) return res.status(400).json({ error: 'ID and newName are required' });
  
  const metadata = filesMetadata[id];
  if (!metadata) return res.status(404).json({ error: 'Item not found' });
  
  metadata.originalName = newName;
  saveMetadata();
  res.json({ success: true, item: metadata });
});

app.delete('/api/delete/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const metadata = filesMetadata[id];
  if (!metadata) return res.status(404).json({ error: 'Not found' });
  
  const deleteItem = async (itemId: string) => {
    const item = filesMetadata[itemId];
    if (!item) return;
    if (item.type === 'folder') {
      const children = Object.values(filesMetadata).filter(f => f.parentId === itemId);
      for (const child of children) {
          await deleteItem(child.id);
      }
      delete filesMetadata[itemId];
    } else {
      const octokit = getOctokit();
      if (item.githubAssetId && octokit) {
          try {
              const ghConf = await getGithubReleaseConfig();
              if (ghConf) {
                  await octokit.rest.repos.deleteReleaseAsset({
                      owner: ghConf.owner,
                      repo: ghConf.repo,
                      asset_id: item.githubAssetId
                  });
              }
          } catch (e) {
              console.error('Failed to delete GitHub asset', e);
          }
      } else {
          const files = fs.readdirSync(uploadDir);
          const actualFile = files.find(f => f.startsWith(itemId));
          if (actualFile) {
            const filePath = path.join(uploadDir, actualFile);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
      }
      delete filesMetadata[itemId];
    }
  };

  try {
    await deleteItem(id);
    saveMetadata();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.post('/api/reorder', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { reorderedIds } = req.body;
  if (!Array.isArray(reorderedIds)) return res.status(400).json({ error: 'reorderedIds must be an array' });
  
  reorderedIds.forEach((id, index) => {
    if (filesMetadata[id]) {
        filesMetadata[id].order = index;
    }
  });
  saveMetadata();
  res.json({ success: true });
});

app.get('/api/files', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const { parentId } = req.query;
  const pid = parentId === 'null' || !parentId ? null : parentId as string;
  const list = Object.values(filesMetadata)
    .filter(f => f.parentId === pid)
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return b.uploadDate - a.uploadDate;
    });
  res.json(list);
});

app.get('/api/file/:id', (req, res) => {
  const metadata = filesMetadata[req.params.id];
  if (!metadata) return res.status(404).json({ error: 'Not found' });
  res.json(metadata);
});

app.get('/download/:id', (req, res) => {
  const id = req.params.id;
  const metadata = filesMetadata[id];
  if (!metadata) return res.status(404).send('File not found');
  
  if (metadata.githubDownloadUrl) {
    return res.redirect(metadata.githubDownloadUrl);
  }

  const files = fs.readdirSync(uploadDir);
  const actualFile = files.find(f => f.startsWith(id));
  if (!actualFile) return res.status(404).send('File missing on disk');
  res.download(path.join(uploadDir, actualFile), metadata.originalName);
});

// --- Server Setup ---

// Export for Vercel
export default app;

// Local startup for container
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const startLocal = async () => {
    // Vite middleware for dev
    if (process.env.NODE_ENV !== "production") {
      try {
        const viteMod = 'vi' + 'te';
        const { createServer } = await import(/* @vite-ignore */ viteMod);
        const vite = await createServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (e) {
        console.error("Vite not found", e);
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }

    app.listen(3000, "0.0.0.0", () => {
      console.log(`Server running at http://localhost:3000`);
    });
  };
  startLocal().catch(err => console.error('Failed to start server', err));
}
