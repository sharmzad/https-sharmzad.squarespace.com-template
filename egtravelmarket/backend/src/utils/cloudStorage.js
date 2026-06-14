const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

const storageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

function getPrivateObjectDir() {
  const dir = process.env.PRIVATE_OBJECT_DIR || '';
  if (!dir) {
    throw new Error('PRIVATE_OBJECT_DIR not set');
  }
  return dir;
}

function getPublicSearchPaths() {
  const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
  return pathsStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
}

function parseObjectPath(objPath) {
  if (!objPath.startsWith('/')) {
    objPath = '/' + objPath;
  }
  const parts = objPath.split('/');
  if (parts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }
  return {
    bucketName: parts[1],
    objectName: parts.slice(2).join('/'),
  };
}

async function uploadFileToCloud(localFilePath, originalFilename, contentType) {
  try {
    const privateDir = getPrivateObjectDir();
    const ext = path.extname(originalFilename).toLowerCase();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const cloudFilename = `${Date.now()}-${randomBytes}${ext}`;
    const fullPath = `${privateDir}/uploads/${cloudFilename}`;
    
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(fs.readFileSync(localFilePath), {
      contentType: contentType || 'application/octet-stream',
      metadata: {
        metadata: {
          originalFilename: originalFilename,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
    
    fs.unlink(localFilePath, (err) => {
      if (err) console.error('Failed to delete local temp file:', err.message);
    });
    
    const objectPath = `/objects/uploads/${cloudFilename}`;
    console.log(`☁️  Uploaded to cloud: ${objectPath}`);
    return objectPath;
  } catch (error) {
    console.error('☁️  Cloud upload failed:', error.message);
    throw error;
  }
}

async function getCloudFile(objectPath) {
  try {
    if (!objectPath.startsWith('/objects/')) {
      return null;
    }
    
    const entityId = objectPath.slice('/objects/'.length);
    let entityDir = getPrivateObjectDir();
    if (!entityDir.endsWith('/')) {
      entityDir = entityDir + '/';
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    return file;
  } catch (error) {
    console.error('☁️  Cloud file lookup failed:', error.message);
    return null;
  }
}

async function streamCloudFile(objectPath, res) {
  const file = await getCloudFile(objectPath);
  if (!file) {
    return false;
  }
  
  try {
    const [metadata] = await file.getMetadata();
    res.set({
      'Content-Type': metadata.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
    });
    if (metadata.size) {
      res.set('Content-Length', String(metadata.size));
    }
    
    const stream = file.createReadStream();
    stream.on('error', (err) => {
      console.error('☁️  Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).send('Error streaming file');
      }
    });
    stream.pipe(res);
    return true;
  } catch (error) {
    console.error('☁️  Stream cloud file failed:', error.message);
    return false;
  }
}

async function getSignedUrl(objectPath, ttlSec = 3600) {
  const file = await getCloudFile(objectPath);
  if (!file) return null;
  
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + ttlSec * 1000,
  });
  return url;
}

function isCloudPath(urlPath) {
  return urlPath && urlPath.startsWith('/objects/');
}

module.exports = {
  uploadFileToCloud,
  getCloudFile,
  streamCloudFile,
  getSignedUrl,
  isCloudPath,
  storageClient,
};
