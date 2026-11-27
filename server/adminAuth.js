/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const SCRYPT_KEYLEN = 64;

function constantTimeEqualsString(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison of same length to avoid early-exit timing signal
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashAdminPassword(password, saltHex = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), saltHex, SCRYPT_KEYLEN).toString('hex');
  return { salt: saltHex, hash: derived };
}

export function verifyAdminPassword(password, saltHex, expectedHashHex) {
  if (!password || !saltHex || !expectedHashHex) return false;
  try {
    const derived = crypto.scryptSync(String(password), String(saltHex), SCRYPT_KEYLEN);
    const expected = Buffer.from(String(expectedHashHex), 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function createAdminAuthManager({ getStoredAuth, saveStoredAuth }) {
  const sessionSecret =
    (process.env.ADMIN_SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
  const activeSessions = new Map();
  const failedAttemptsByIp = new Map();
  let setupLockInProgress = false;

  const getEnvCredentials = () => {
    const username = (process.env.ADMIN_USERNAME || '').trim();
    const password = process.env.ADMIN_PASSWORD || '';
    if (username && password) {
      return { username, password };
    }
    return null;
  };

  const signSessionId = (sessionId) =>
    crypto.createHmac('sha256', sessionSecret).update(sessionId).digest('hex');

  const issueSession = (username) => {
    const now = Date.now();
    // Prune expired sessions opportunistically
    for (const [sid, info] of activeSessions.entries()) {
      if (info.expiresAt <= now) activeSessions.delete(sid);
    }
    const sessionId = crypto.randomBytes(24).toString('hex');
    const expiresAt = now + SESSION_TTL_MS;
    activeSessions.set(sessionId, { username, createdAt: now, expiresAt });
    const sig = signSessionId(sessionId);
    return { token: `${sessionId}.${sig}`, expiresAt };
  };

  const verifyBearerToken = (authHeader) => {
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const raw = authHeader.slice(7).trim();
    const dotIdx = raw.indexOf('.');
    if (dotIdx <= 0 || dotIdx === raw.length - 1) return null;
    const sessionId = raw.slice(0, dotIdx);
    const providedSig = raw.slice(dotIdx + 1);
    const expectedSig = signSessionId(sessionId);
    if (!constantTimeEqualsString(providedSig, expectedSig)) return null;

    const record = activeSessions.get(sessionId);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      activeSessions.delete(sessionId);
      return null;
    }
    return { sessionId, ...record };
  };

  const revokeBearerToken = (authHeader) => {
    const verified = verifyBearerToken(authHeader);
    if (verified) {
      activeSessions.delete(verified.sessionId);
      return true;
    }
    return false;
  };

  const revokeAllSessions = () => {
    activeSessions.clear();
  };

  const getClientIp = (req) => {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) {
      return fwd.split(',')[0].trim().slice(0, 64);
    }
    return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
  };

  const checkRateLimit = (req) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = failedAttemptsByIp.get(ip);
    if (!entry) return { limited: false, retryAfterSec: 0 };
    if (now - entry.windowStart >= LOCKOUT_WINDOW_MS) {
      failedAttemptsByIp.delete(ip);
      return { limited: false, retryAfterSec: 0 };
    }
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      const remaining = Math.ceil((LOCKOUT_WINDOW_MS - (now - entry.windowStart)) / 1000);
      return { limited: true, retryAfterSec: Math.max(1, remaining) };
    }
    return { limited: false, retryAfterSec: 0 };
  };

  const recordFailedAttempt = (req) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = failedAttemptsByIp.get(ip);
    if (!entry || now - entry.windowStart >= LOCKOUT_WINDOW_MS) {
      failedAttemptsByIp.set(ip, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
  };

  const clearFailedAttempts = (req) => {
    failedAttemptsByIp.delete(getClientIp(req));
  };

  const getStatus = async () => {
    const envCreds = getEnvCredentials();
    if (envCreds) {
      return {
        needsSetup: false,
        authMode: 'env',
      };
    }
    const stored = await getStoredAuth();
    if (stored && stored.username && stored.salt && stored.hash) {
      return {
        needsSetup: false,
        authMode: 'claimed',
      };
    }
    return {
      needsSetup: true,
      authMode: 'unclaimed',
    };
  };

  const claimInitialAdmin = async (username, password) => {
    if (getEnvCredentials()) {
      return { ok: false, status: 409, error: 'Admin credentials are already configured via environment variables.' };
    }
    if (setupLockInProgress) {
      return { ok: false, status: 409, error: 'Admin setup is already in progress.' };
    }
    setupLockInProgress = true;
    try {
      const existing = await getStoredAuth();
      if (existing && existing.username && existing.salt && existing.hash) {
        return { ok: false, status: 409, error: 'Admin account has already been claimed. Please sign in.' };
      }
      const cleanUser = String(username || '').trim();
      const rawPass = String(password || '');
      if (cleanUser.length < 3 || cleanUser.length > 32 || !/^[A-Za-z0-9._-]+$/.test(cleanUser)) {
        return {
          ok: false,
          status: 400,
          error: 'Username must be 3-32 characters (letters, numbers, ., _, or -).',
        };
      }
      if (rawPass.length < 8 || rawPass.length > 128) {
        return { ok: false, status: 400, error: 'Password must be between 8 and 128 characters.' };
      }
      const { salt, hash } = hashAdminPassword(rawPass);
      await saveStoredAuth({
        username: cleanUser,
        salt,
        hash,
        createdAt: Date.now(),
      });
      const session = issueSession(cleanUser);
      return { ok: true, username: cleanUser, ...session };
    } finally {
      setupLockInProgress = false;
    }
  };

  const authenticate = async (req, username, password) => {
    const rl = checkRateLimit(req);
    if (rl.limited) {
      return {
        ok: false,
        status: 429,
        error: `Too many failed sign-in attempts. Try again in ${rl.retryAfterSec}s.`,
      };
    }
    const cleanUser = String(username || '').trim();
    const rawPass = String(password || '');
    if (!cleanUser || !rawPass) {
      recordFailedAttempt(req);
      return { ok: false, status: 401, error: 'Invalid username or password.' };
    }

    const envCreds = getEnvCredentials();
    if (envCreds) {
      const userMatch = constantTimeEqualsString(cleanUser, envCreds.username);
      const passMatch = constantTimeEqualsString(rawPass, envCreds.password);
      if (userMatch && passMatch) {
        clearFailedAttempts(req);
        const session = issueSession(envCreds.username);
        return { ok: true, username: envCreds.username, authMode: 'env', ...session };
      }
      recordFailedAttempt(req);
      return { ok: false, status: 401, error: 'Invalid username or password.' };
    }

    const stored = await getStoredAuth();
    if (!stored || !stored.username || !stored.salt || !stored.hash) {
      return {
        ok: false,
        status: 409,
        error: 'Admin account is not set up yet. Complete first-run setup first.',
      };
    }

    const userMatch = constantTimeEqualsString(cleanUser, stored.username);
    const passMatch = verifyAdminPassword(rawPass, stored.salt, stored.hash);
    if (userMatch && passMatch) {
      clearFailedAttempts(req);
      const session = issueSession(stored.username);
      return { ok: true, username: stored.username, authMode: 'claimed', ...session };
    }

    recordFailedAttempt(req);
    return { ok: false, status: 401, error: 'Invalid username or password.' };
  };

  const rotatePassword = async (currentPassword, newPassword) => {
    if (getEnvCredentials()) {
      return {
        ok: false,
        status: 400,
        error: 'Password is managed by server environment variables (ADMIN_PASSWORD). Update it in your hosting Secrets panel.',
      };
    }
    const stored = await getStoredAuth();
    if (!stored || !stored.salt || !stored.hash) {
      return { ok: false, status: 400, error: 'No stored admin account found.' };
    }
    if (!verifyAdminPassword(currentPassword, stored.salt, stored.hash)) {
      return { ok: false, status: 401, error: 'Current password is incorrect.' };
    }
    const rawNew = String(newPassword || '');
    if (rawNew.length < 8 || rawNew.length > 128) {
      return { ok: false, status: 400, error: 'New password must be between 8 and 128 characters.' };
    }
    const { salt, hash } = hashAdminPassword(rawNew);
    await saveStoredAuth({
      ...stored,
      salt,
      hash,
      updatedAt: Date.now(),
    });
    revokeAllSessions();
    const session = issueSession(stored.username);
    return { ok: true, username: stored.username, ...session };
  };

  const requireAdminAuth = (req, res, next) => {
    const verified = verifyBearerToken(req.headers.authorization);
    if (!verified) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }
    req.adminUser = verified;
    return next();
  };

  return {
    getStatus,
    claimInitialAdmin,
    authenticate,
    rotatePassword,
    verifyBearerToken,
    revokeBearerToken,
    requireAdminAuth,
  };
}
