const fs = require('fs');
const path = require('path');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
const googleServicesPath = path.join(projectRoot, 'google-services.json');
const placeholder = '__FIREBASE_ANDROID_API_KEY__';

loadEnvFile(envPath);

const firebaseAndroidApiKey = process.env.FIREBASE_ANDROID_API_KEY;
if (!firebaseAndroidApiKey) {
  console.error('Missing FIREBASE_ANDROID_API_KEY in .env.');
  process.exit(1);
}

if (!fs.existsSync(googleServicesPath)) {
  console.error('google-services.json not found.');
  process.exit(1);
}

const rawGoogleServices = fs.readFileSync(googleServicesPath, 'utf8');
if (!rawGoogleServices.includes(placeholder) && !rawGoogleServices.includes(firebaseAndroidApiKey)) {
  console.error('google-services.json does not contain the expected placeholder token.');
  process.exit(1);
}

const nextGoogleServices = rawGoogleServices.replaceAll(placeholder, firebaseAndroidApiKey);
fs.writeFileSync(googleServicesPath, nextGoogleServices, 'utf8');

console.log('Injected FIREBASE_ANDROID_API_KEY into google-services.json');
