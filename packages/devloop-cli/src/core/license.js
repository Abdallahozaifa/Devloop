import fs from 'fs';
import os from 'os';
import { API_URL, LICENSE_CACHE_FILE, saveConfig, loadConfig } from './config.js';

const LICENSE_CACHE_HOURS = 24;

function getCachedLicense() {
  try {
    if (!fs.existsSync(LICENSE_CACHE_FILE)) return null;

    const cache = JSON.parse(fs.readFileSync(LICENSE_CACHE_FILE, 'utf8'));
    const age = (Date.now() - cache.timestamp) / (1000 * 60 * 60);

    if (age > LICENSE_CACHE_HOURS) {
      return null; // Cache expired
    }

    return cache;
  } catch {
    return null;
  }
}

function saveLicenseCache(licenseKey, data) {
  const cache = {
    license_key: licenseKey,
    timestamp: Date.now(),
    ...data,
  };
  fs.writeFileSync(LICENSE_CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function verifyLicense(licenseKey) {
  // Check cache first
  const cached = getCachedLicense();
  if (cached && cached.license_key === licenseKey && cached.valid) {
    return {
      valid: true,
      cached: true,
      plan: cached.plan,
      email: cached.email,
      throttle: cached.throttle,
    };
  }

  // Verify with API
  try {
    const response = await fetch(`${API_URL}/api/v1/license/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        machine_id: os.hostname(),
      }),
    });

    const data = await response.json();

    if (response.ok && data.valid) {
      saveLicenseCache(licenseKey, data);

      // Also save to project config
      const config = loadConfig();
      config.license_key = licenseKey;
      saveConfig(config);

      return {
        valid: true,
        cached: false,
        plan: data.plan,
        email: data.email,
        throttle: data.throttle,
      };
    }

    return {
      valid: false,
      message: data.message || 'Invalid license key',
    };
  } catch (error) {
    // If API is unreachable, use cached data if available (grace period)
    if (cached && cached.license_key === licenseKey) {
      return {
        valid: true,
        cached: true,
        plan: cached.plan,
        email: cached.email,
        offline: true,
      };
    }

    return {
      valid: false,
      message: 'Could not verify license. Check your internet connection.',
    };
  }
}

export async function recordRun(licenseKey) {
  try {
    const response = await fetch(`${API_URL}/api/v1/license/record-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey }),
    });

    if (response.ok) {
      return await response.json();
    }

    return { success: false };
  } catch {
    // Silent failure for run recording
    return { success: false };
  }
}

export function validateLicenseFormat(key) {
  const pattern = /^DL-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i;
  return pattern.test(key);
}
