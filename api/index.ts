import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import https from 'https';
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";

dotenv.config({ path: path.join(process.cwd(), '.env') });

const MyOctokit = Octokit.plugin(restEndpointMethods, paginateRest);

function getOctokit() {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  if (process.env.GITHUB_TOKEN) {
    return new MyOctokit({ auth: process.env.GITHUB_TOKEN });
  }
  // Public repo fallback (no token needed for read-only access)
  return new MyOctokit();
}

async function getGithubReleaseConfig() {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  const octokit = getOctokit();
  if (!octokit) return null;
  const repoStr = process.env.GITHUB_REPO || 'kaerutempest/ClodyStorage';
  const parts = repoStr.split('/');
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1], tag: process.env.GITHUB_RELEASE_TAG || 'Kaeblox(ForA12+)' };
}

const getAdminPassword = () => {
  const envPass = (process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
  if (envPass && envPass !== 'supersecretpassword') return envPass;
  return 'Tempest2271';
};

const ADMIN_PASSWORD = getAdminPassword();

const app = express();

const isVercel = !!process.env.VERCEL;
let dataDir = path.join(process.cwd(), '.data');

if (isVercel) {
  dataDir = '/tmp/.data';
} else {
  // Perform runtime write test on the .data path. If it is read-only, fallback to standard /tmp/.data
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const testFile = path.join(dataDir, '.write_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    console.warn('.data directory under root path is not writable, falling back to /tmp/.data: ', err);
    dataDir = '/tmp/.data';
  }
}

// Ensure uploads directory exists for local/container dev
const uploadDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    console.error('Failed to create upload dir', e);
  }
}

// Metadata/Settings paths
const metadataFilePath = path.join(dataDir, 'metadata.json_db');
const settingsFilePath = path.join(dataDir, 'settings.json_db');

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
  githubReleaseTag?: string;
  downloadCount?: number;
}

let filesMetadata: Record<string, FileMetadata> = {};
let settings: { backgroundImage: string; maintenanceMode: boolean; backgroundLocked: boolean } = { backgroundImage: '', maintenanceMode: false, backgroundLocked: false };

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

const ensurePrepopulatedResources = () => {
  const KAEBLOX_FOLDER_ID = 'c51a3e51f82873d1';
  const KAEDEX_FOLDER_ID = 'bbc485cc42f83b2f';

  // Clean up any old erroneously duplicated Kaedex files that were stored inside Kaeblox folder
  Object.keys(filesMetadata).forEach(id => {
    const f = filesMetadata[id];
    if (f && f.parentId === KAEBLOX_FOLDER_ID && f.originalName.toLowerCase().includes('kaedex')) {
      delete filesMetadata[id];
    }
  });

  // 1. Ensure Kaeblox folder exists
  if (!filesMetadata[KAEBLOX_FOLDER_ID]) {
    filesMetadata[KAEBLOX_FOLDER_ID] = {
      id: KAEBLOX_FOLDER_ID,
      originalName: 'Kaeblox ( Android 11-17+ )',
      size: 0,
      mimeType: 'application/x-directory',
      uploadDate: 1779110521922,
      type: 'folder',
      parentId: null,
      githubReleaseTag: 'Kaeblox(ForA12+)'
    };
  } else {
    // If folder exists, make sure name and release tag are correct
    filesMetadata[KAEBLOX_FOLDER_ID].originalName = 'Kaeblox ( Android 11-17+ )';
    filesMetadata[KAEBLOX_FOLDER_ID].githubReleaseTag = 'Kaeblox(ForA12+)';
    filesMetadata[KAEBLOX_FOLDER_ID].type = 'folder';
    filesMetadata[KAEBLOX_FOLDER_ID].parentId = null;
  }

  // 2. Ensure Kaedex folder exists
  if (!filesMetadata[KAEDEX_FOLDER_ID]) {
    filesMetadata[KAEDEX_FOLDER_ID] = {
      id: KAEDEX_FOLDER_ID,
      originalName: 'Kaedex ( Android 11-17+ ) [ Non Key ]',
      size: 0,
      mimeType: 'application/x-directory',
      uploadDate: 1780972012230,
      type: 'folder',
      parentId: null,
      githubReleaseTag: 'Kaedex'
    };
  } else {
    filesMetadata[KAEDEX_FOLDER_ID].originalName = 'Kaedex ( Android 11-17+ ) [ Non Key ]';
    filesMetadata[KAEDEX_FOLDER_ID].githubReleaseTag = 'Kaedex';
    filesMetadata[KAEDEX_FOLDER_ID].type = 'folder';
    filesMetadata[KAEDEX_FOLDER_ID].parentId = null;
  }

  // 3. Ensure the 6 APKs exist inside the Kaeblox folder
  const kaebloxApks = [
    { name: 'Kaeblox_1.apk', id: '333bf9a79acaabd8', assetId: 442282636, order: 1 },
    { name: 'Kaeblox_2.apk', id: '265bd61f51043795', assetId: 442282823, order: 2 },
    { name: 'Kaeblox_3.apk', id: '7a5a47fddaec128e', assetId: 442283208, order: 3 },
    { name: 'Kaeblox_4.apk', id: '8e59efeb2570fe2d', assetId: 442283710, order: 4 },
    { name: 'Kaeblox_5.apk', id: 'afe8800e2d890f8b', assetId: 442284104, order: 5 },
    { name: 'Kaeblox_6.apk', id: '0d69c32ef99e9916', assetId: 442284542, order: 6 }
  ];

  kaebloxApks.forEach((apk, index) => {
    if (!filesMetadata[apk.id]) {
      filesMetadata[apk.id] = {
        id: apk.id,
        originalName: apk.name,
        size: 118039181,
        mimeType: 'application/vnd.android.package-archive',
        uploadDate: 1779110521923 + index,
        type: 'file',
        parentId: KAEBLOX_FOLDER_ID,
        githubAssetId: apk.assetId,
        githubDownloadUrl: `https://github.com/kaerutempest/ClodyStorage/releases/download/Kaeblox%28ForA12%2B%29/${apk.name}`,
        order: apk.order
      };
    } else {
      // Ensure the download urls, parentId, and naming are completely aligned
      filesMetadata[apk.id].originalName = apk.name;
      filesMetadata[apk.id].parentId = KAEBLOX_FOLDER_ID;
      filesMetadata[apk.id].githubDownloadUrl = `https://github.com/kaerutempest/ClodyStorage/releases/download/Kaeblox%28ForA12%2B%29/${apk.name}`;
      filesMetadata[apk.id].order = apk.order;
      filesMetadata[apk.id].size = 118039181;
      filesMetadata[apk.id].githubAssetId = apk.assetId;
    }
  });

  // 4. Ensure the 6 APKs exist inside the Kaedex folder
  const kaedexApks = [
    { name: 'Kaedex_1.apk', id: '420fc42814db62cf', assetId: 442316865, order: 1 },
    { name: 'Kaedex_2.apk', id: 'd36830df16d6e7ae', assetId: 442317733, order: 2 },
    { name: 'Kaedex_3.apk', id: '7a66b06cc1a91885', assetId: 442318468, order: 3 },
    { name: 'Kaedex_4.apk', id: 'cc64aa222d69740a', assetId: 442318771, order: 4 },
    { name: 'Kaedex_5.apk', id: 'f6980f0ddc0fc10f', assetId: 442319153, order: 5 },
    { name: 'Kaedex_6.apk', id: '72bb15566b7d937c', assetId: 442319514, order: 6 }
  ];

  kaedexApks.forEach((apk, index) => {
    if (!filesMetadata[apk.id]) {
      filesMetadata[apk.id] = {
        id: apk.id,
        originalName: apk.name,
        size: 102878407,
        mimeType: 'application/vnd.android.package-archive',
        uploadDate: 1780972168586 + index,
        type: 'file',
        parentId: KAEDEX_FOLDER_ID,
        githubAssetId: apk.assetId,
        githubDownloadUrl: `https://github.com/kaerutempest/ClodyStorage/releases/download/Kaedex/${apk.name}`,
        order: apk.order
      };
    } else {
      // Ensure the download urls, parentId, and naming are completely aligned
      filesMetadata[apk.id].originalName = apk.name;
      filesMetadata[apk.id].parentId = KAEDEX_FOLDER_ID;
      filesMetadata[apk.id].githubDownloadUrl = `https://github.com/kaerutempest/ClodyStorage/releases/download/Kaedex/${apk.name}`;
      filesMetadata[apk.id].order = apk.order;
      filesMetadata[apk.id].size = 102878407;
      filesMetadata[apk.id].githubAssetId = apk.assetId;
    }
  });

  saveMetadata();
};

const loadData = () => {
  // Restore metadata from bundled fallback if active path doesn't exist
  if (!fs.existsSync(metadataFilePath)) {
    const backupPath = path.join(process.cwd(), '.data', 'metadata.json_db');
    if (fs.existsSync(backupPath)) {
      try {
        console.log('Restoring metadata database from bundled backup...');
        fs.mkdirSync(path.dirname(metadataFilePath), { recursive: true });
        fs.copyFileSync(backupPath, metadataFilePath);
      } catch (err) {
        console.error('Failed to copy metadata backup:', err);
      }
    }
  }

  // Restore settings from bundled fallback if active path doesn't exist
  if (!fs.existsSync(settingsFilePath)) {
    const backupPath = path.join(process.cwd(), '.data', 'settings.json_db');
    if (fs.existsSync(backupPath)) {
      try {
        console.log('Restoring settings database from bundled backup...');
        fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
        fs.copyFileSync(backupPath, settingsFilePath);
      } catch (err) {
        console.error('Failed to copy settings backup:', err);
      }
    }
  }

  if (fs.existsSync(metadataFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));
      Object.keys(data).forEach(id => {
        if (!data[id].type) data[id].type = 'file';
        if (data[id].parentId === undefined) data[id].parentId = null;
      });
      filesMetadata = data;

      // Auto-migrate & backfill githubReleaseTag for existing folders
      Object.keys(filesMetadata).forEach(id => {
        const folder = filesMetadata[id];
        if (folder.type === 'folder') {
          if (!folder.githubReleaseTag) {
            // Find any child file with a githubDownloadUrl to extract the tag name
            const gitChild = Object.values(filesMetadata).find(
              f => f.parentId === id && f.githubDownloadUrl
            );
            if (gitChild && gitChild.githubDownloadUrl) {
              const match = gitChild.githubDownloadUrl.match(/\/releases\/download\/([^/]+)\//);
              if (match && match[1]) {
                folder.githubReleaseTag = decodeURIComponent(match[1]);
                console.log(`Backfilled githubReleaseTag for folder "${folder.originalName}" with tag "${folder.githubReleaseTag}"`);
              }
            } else if (folder.originalName.toLowerCase().includes('kaeblox')) {
              folder.githubReleaseTag = 'Kaeblox(ForA12+)';
              console.log(`Fallback backfilled githubReleaseTag for Kaeblox folder "${folder.originalName}"`);
            }
          }

          // Force rename Kaeblox version variations to 'Kaeblox ( Android 11-17+ )' as requested by user
          if (folder.githubReleaseTag === 'Kaeblox(ForA12+)' || folder.originalName === 'Kaeblox 2.720.716' || folder.originalName === 'Kaeblox' || folder.originalName === 'Kaeblox(A11-17+)') {
            folder.originalName = 'Kaeblox ( Android 11-17+ )';
          }

          // Force rename Kaedex version variations to 'Kaedex ( Android 11-17+ ) [ Non Key ]' as requested by user
          if (folder.originalName === 'Kaedex' || folder.originalName.toLowerCase().includes('kaedex') || folder.githubReleaseTag?.toLowerCase().includes('kaedex')) {
            folder.originalName = 'Kaedex ( Android 11-17+ ) [ Non Key ]';
          }
        }
      });
    } catch (e) {
      filesMetadata = {};
    }
  }

  // Ensure Kaeblox & Kaedex folders & files are pre-populated so they are NEVER missing or empty
  ensurePrepopulatedResources();

  if (fs.existsSync(settingsFilePath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
    } catch (e) { settings = { backgroundImage: '', maintenanceMode: false, backgroundLocked: false }; }
  }
};

loadData();

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
  
  let defaultBackground = '';
  
  // Check github synced files in metadata first
  const githubBg = Object.values(filesMetadata).find(f => 
    f.type === 'file' && f.originalName && f.originalName.match(/^background\.(jpg|jpeg|png|webp)$/i)
  );
  if (githubBg) {
    defaultBackground = `/preview/${githubBg.id}`;
  }
  // Then check root dir
  else if (fs.existsSync(path.join(process.cwd(), 'background.jpg'))) {
    defaultBackground = '/local-bg/background.jpg';
  } else if (fs.existsSync(path.join(process.cwd(), 'background.png'))) {
    defaultBackground = '/local-bg/background.png';
  } else if (fs.existsSync(path.join(process.cwd(), 'background.webp'))) {
    defaultBackground = '/local-bg/background.webp';
  } else if (fs.existsSync(path.join(process.cwd(), 'public', 'background.jpg'))) {
    defaultBackground = '/background.jpg';
  } else if (fs.existsSync(path.join(process.cwd(), 'public', 'background.png'))) {
    defaultBackground = '/background.png';
  } else if (fs.existsSync(path.join(process.cwd(), 'public', 'background.webp'))) {
    defaultBackground = '/background.webp';
  }

  res.json({
    ...settings,
    defaultBackground
  });
});

app.post('/api/settings/background', (req, res, next) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (settings.backgroundLocked) return res.status(403).json({ error: 'Background is locked' });
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
  settings.backgroundImage = `/preview/${id}`;
  saveSettings();
  res.json({ success: true, url: settings.backgroundImage });
});

app.post('/api/settings/background-url', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (settings.backgroundLocked) return res.status(403).json({ error: 'Background is locked' });
  const { url } = req.body;
  if (typeof url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
  settings.backgroundImage = url;
  saveSettings();
  res.json({ success: true, url: settings.backgroundImage });
});

app.post('/api/settings/reset-background', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (settings.backgroundLocked) return res.status(403).json({ error: 'Background is locked' });
  settings.backgroundImage = '';
  saveSettings();
  res.json({ success: true });
});

app.post('/api/settings/toggle-lock-background', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  settings.backgroundLocked = !settings.backgroundLocked;
  saveSettings();
  res.json({ success: true, locked: settings.backgroundLocked });
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
      type: 'file', parentId: parentId || null,
      downloadCount: 0
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

let lastAutoSyncTime = 0;
const AUTO_SYNC_COOLDOWN = 10 * 60 * 1000; // 10 minutes cache/cooldown for public requests

async function autoSyncGithub(force = false) {
  const now = Date.now();
  if (!force && (now - lastAutoSyncTime < AUTO_SYNC_COOLDOWN)) {
    console.log('AutoSync: within cooldown, skipping auto-sync.');
    return { success: true, message: 'Already synced recently' };
  }
  lastAutoSyncTime = now;

  console.log(`Running GitHub Sync... (force=${force})`);
  const ghConf = await getGithubReleaseConfig();
  const octokit = getOctokit();
  if (!ghConf || !octokit) {
    console.log('GitHub config is not full/missing template fallback');
    return { error: 'GitHub config missing' };
  }

  let releasesList: any[] = [];
  try {
      const relListResp = await octokit.rest.repos.listReleases({
          owner: ghConf.owner,
          repo: ghConf.repo,
          per_page: 30
      });
      releasesList = relListResp.data;
  } catch (listErr) {
      console.warn('AutoSync: listing all releases failed, trying tag backup', listErr);
  }

  if (releasesList.length === 0 && ghConf.tag) {
      try {
          const releaseResp = await octokit.rest.repos.getReleaseByTag({ 
              owner: ghConf.owner, 
              repo: ghConf.repo, 
              tag: ghConf.tag 
          });
          releasesList = [releaseResp.data];
      } catch (tagErr) {
          console.error('AutoSync: tag fallback failed', tagErr);
      }
  }

  if (releasesList.length === 0) {
      return { error: 'No releases found on GitHub' };
  }

  let totalAdded = 0;
  let totalUpdated = 0;
  const syncedFolderIds: string[] = [];

  for (const release of releasesList) {
      const { name: releaseName, tag_name: tag_name, assets } = release;
      let displayFolderName = releaseName || tag_name;

      // Force format folder name for Kaeblox as demanded by user to prevent "empty folders"
      if (tag_name === 'Kaeblox(ForA12+)' || displayFolderName === 'Kaeblox' || displayFolderName === 'Kaeblox(A11-17+)') {
          displayFolderName = 'Kaeblox ( Android 11-17+ )';
      }

      // Force format folder name for Kaedex as demanded by user
      if (tag_name?.toLowerCase().includes('kaedex') || displayFolderName?.toLowerCase().includes('kaedex') || displayFolderName === 'Kaedex') {
          displayFolderName = 'Kaedex ( Android 11-17+ ) [ Non Key ]';
      }

      // Find or create the directory folder for this release
      const isCurrentKaeblox = !!(tag_name?.toLowerCase().includes('kaeblox') || displayFolderName?.toLowerCase().includes('kaeblox'));
      const isCurrentKaedex = !!(tag_name?.toLowerCase().includes('kaedex') || displayFolderName?.toLowerCase().includes('kaedex'));

      let folderId = Object.keys(filesMetadata).find(id => {
          const f = filesMetadata[id];
          if (f.type !== 'folder') return false;

          // If the folder has the exact same tag name, it's definitely a match
          if (f.githubReleaseTag === tag_name) return true;

          // If the current release we are processing is Kaeblox
          if (isCurrentKaeblox) {
              const fNameLower = f.originalName.toLowerCase();
              const fTagLower = f.githubReleaseTag?.toLowerCase() || '';
              if (fNameLower.includes('kaeblox') || fTagLower.includes('kaeblox') || fNameLower === 'kaeblox(a11-17+)' || fNameLower === 'kaeblox 2.720.716') {
                  return true;
              }
          }

          // If the current release we are processing is Kaedex
          if (isCurrentKaedex) {
              const fNameLower = f.originalName.toLowerCase();
              const fTagLower = f.githubReleaseTag?.toLowerCase() || '';
              if (fNameLower.includes('kaedex') || fTagLower.includes('kaedex')) {
                  return true;
              }
          }

          // Direct generic match
          if (f.originalName === displayFolderName || f.originalName === tag_name) return true;

          return false;
      });

      if (!folderId) {
          folderId = crypto.randomBytes(8).toString('hex');
          filesMetadata[folderId] = {
              id: folderId,
              originalName: displayFolderName,
              size: 0,
              mimeType: 'application/x-directory',
              uploadDate: Date.now(),
              type: 'folder',
              parentId: null,
              githubReleaseTag: tag_name
          };
      } else {
          // Keep name up to date but preserve rename if done via admin manual
          if (tag_name === 'Kaeblox(ForA12+)' || displayFolderName === 'Kaeblox ( Android 11-17+ )' || displayFolderName === 'Kaeblox(A11-17+)') {
              filesMetadata[folderId].originalName = displayFolderName;
          }
          if (tag_name?.toLowerCase().includes('kaedex') || displayFolderName === 'Kaedex ( Android 11-17+ ) [ Non Key ]') {
              filesMetadata[folderId].originalName = displayFolderName;
          }
          if (!filesMetadata[folderId].githubReleaseTag) {
              filesMetadata[folderId].githubReleaseTag = tag_name;
          }
      }
      
      if (!syncedFolderIds.includes(folderId)) {
          syncedFolderIds.push(folderId);
      }

      // Sync and backfill all file assets inside the release folder
      for (const asset of assets) {
          const matchedFile = Object.values(filesMetadata).find(
              f => f.parentId === folderId && (f.githubAssetId === asset.id || f.originalName === asset.name)
          );

          if (!matchedFile) {
              const fileId = crypto.randomBytes(8).toString('hex');
              filesMetadata[fileId] = {
                  id: fileId,
                  originalName: asset.name,
                  size: asset.size,
                  mimeType: asset.content_type || 'application/vnd.android.package-archive',
                  uploadDate: Date.now(),
                  type: 'file',
                  parentId: folderId,
                  githubAssetId: asset.id,
                  githubDownloadUrl: asset.browser_download_url,
                  downloadCount: 0
              };
              totalAdded++;
          } else {
              let updated = false;
              if (matchedFile.githubAssetId !== asset.id) {
                  matchedFile.githubAssetId = asset.id;
                  updated = true;
              }
              if (matchedFile.size !== asset.size) {
                  matchedFile.size = asset.size;
                  updated = true;
              }
              if (matchedFile.githubDownloadUrl !== asset.browser_download_url) {
                  matchedFile.githubDownloadUrl = asset.browser_download_url;
                  updated = true;
              }
              if (matchedFile.originalName !== asset.name) {
                  matchedFile.originalName = asset.name;
                  updated = true;
              }
              if (updated) {
                  totalUpdated++;
              }
          }
      }
  }

  saveMetadata();

  let msg = `Synced releases successfully.`;
  if (totalAdded > 0 || totalUpdated > 0) {
      msg = `Synced successfully: Added ${totalAdded}, Updated ${totalUpdated} files across ${releasesList.length} releases/folders.`;
  } else {
      msg = `Re-synchronized. All ${releasesList.length} releases are already fully up to date!`;
  }

  return { success: true, added: totalAdded, updated: totalUpdated, message: msg, releasesCount: releasesList.length };
}

app.post('/api/admin/sync-github', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
      const result = await autoSyncGithub(true);
      if (result.error) {
          return res.status(400).json({ error: result.error });
      }
      res.json(result);
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

app.get('/api/files', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const { parentId } = req.query;
  const pid = parentId === 'null' || !parentId ? null : parentId as string;

  // Run silent auto-sync from GitHub if listing root directory or if empty.
  // This ensures the custom folders and APK files are never empty even after container restart/spin-down.
  if (pid === null || Object.keys(filesMetadata).length <= 1) {
    try {
      await autoSyncGithub(false);
    } catch (autoErr) {
      console.error('Failed processing background autoSync:', autoErr);
    }
  }

  const list = Object.values(filesMetadata)
    .filter(f => f.parentId === pid)
    .sort((a, b) => {
      // 1. Explicit manually saved arrangement order
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;

      // 2. Folders always go above files
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;

      // 3. Folder sorting: Keep "Kaeblox" folder at the very top of all folders, then sort others using natural sort
      if (a.type === 'folder' && b.type === 'folder') {
        const aIsKaeblox = a.originalName.toLowerCase().includes('kaeblox');
        const bIsKaeblox = b.originalName.toLowerCase().includes('kaeblox');
        if (aIsKaeblox && !bIsKaeblox) return -1;
        if (!aIsKaeblox && bIsKaeblox) return 1;

        return a.originalName.localeCompare(b.originalName, undefined, { numeric: true, sensitivity: 'base' });
      }

      // 4. File (non-folder) sorting: Sort neatly and sequentially using natural ascending sort
      // This handles current files (like _1.apk, _2.apk) and any future files perfectly
      const nameCompare = a.originalName.localeCompare(b.originalName, undefined, { numeric: true, sensitivity: 'base' });
      if (nameCompare !== 0) {
        return nameCompare;
      }

      // 5. Fallback to newest files first in case properties/names are identical
      return b.uploadDate - a.uploadDate;
    });
  res.json(list);
});

app.get('/api/file/:id', (req, res) => {
  const metadata = filesMetadata[req.params.id];
  if (!metadata) return res.status(404).json({ error: 'Not found' });
  res.json(metadata);
});

app.get('/api/folder-path/:id', (req, res) => {
  const list: any[] = [];
  let currentId: string | null = req.params.id;
  const visited = new Set<string>();
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = filesMetadata[currentId];
    if (!folder) break;
    list.unshift(folder);
    currentId = folder.parentId;
  }
  res.json(list);
});

const streamFromUrl = (url: string, res: express.Response, filename?: string, attempts = 0) => {
  if (attempts > 5) {
    return res.status(500).send('Too many redirects');
  }

  https.get(url, (githubRes) => {
    const statusCode = githubRes.statusCode || 0;

    // Follow HTTP redirects safely
    if (statusCode >= 300 && statusCode < 400 && githubRes.headers.location) {
      return streamFromUrl(githubRes.headers.location, res, filename, attempts + 1);
    }

    if (statusCode >= 400) {
      return res.status(statusCode).send(`Error downloading from storage: ${githubRes.statusMessage || statusCode}`);
    }

    if (filename) {
      // Decode and recode to handle special non-ascii characters nicely
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    }
    
    if (githubRes.headers['content-type']) {
      res.setHeader('Content-Type', githubRes.headers['content-type'] as string);
    } else {
      res.setHeader('Content-Type', filename ? 'application/vnd.android.package-archive' : 'application/octet-stream');
    }
    
    if (githubRes.headers['content-length']) {
      res.setHeader('Content-Length', githubRes.headers['content-length'] as string);
    }

    githubRes.pipe(res);
  }).on('error', (err) => {
    console.error('Streaming failed:', err);
    if (!res.headersSent) {
      res.status(500).send('Connection failed while streaming package');
    }
  });
};

app.get('/download/:id', (req, res) => {
  const id = req.params.id;
  const metadata = filesMetadata[id];
  if (!metadata) return res.status(404).send('File not found');
  
  if (metadata.type !== 'folder') {
    metadata.downloadCount = (metadata.downloadCount || 0) + 1;
    saveMetadata();
  }
  
  if (metadata.githubDownloadUrl) {
    return streamFromUrl(metadata.githubDownloadUrl, res, metadata.originalName);
  }

  const files = fs.readdirSync(uploadDir);
  const actualFile = files.find(f => f.startsWith(id));
  if (!actualFile) return res.status(404).send('File missing on disk');
  res.download(path.join(uploadDir, actualFile), metadata.originalName);
});

app.get('/preview/:id', (req, res) => {
  const id = req.params.id;
  const metadata = filesMetadata[id];
  
  if (metadata && metadata.githubDownloadUrl) {
    return streamFromUrl(metadata.githubDownloadUrl, res);
  }

  const files = fs.readdirSync(uploadDir);
  const actualFile = files.find(f => f.startsWith(id));
  if (!actualFile) return res.status(404).send('File missing on disk');
  res.sendFile(path.join(uploadDir, actualFile));
});

app.get('/local-bg/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!['background.jpg', 'background.jpeg', 'background.png', 'background.webp'].includes(filename.toLowerCase())) {
    return res.status(403).send('Forbidden');
  }
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

app.get('/qris.png', (req, res) => {
  const filePath = path.join(process.cwd(), 'qris.png');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  const uploadDir = path.join(process.cwd(), '.data', 'uploads');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    const qrisOption = files.find(f => f.startsWith('bfaded6f9020d992553b5659973096ce') || f.endsWith('.png'));
    if (qrisOption) {
      const srcPath = path.join(uploadDir, qrisOption);
      try {
        fs.copyFileSync(srcPath, filePath);
        return res.sendFile(filePath);
      } catch (err) {
        return res.sendFile(srcPath);
      }
    }
  }
  res.status(404).send('QRIS image not found');
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
