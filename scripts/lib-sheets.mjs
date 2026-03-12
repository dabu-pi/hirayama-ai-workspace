import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_SHEET_NAME = 'Run_Log';
const DEFAULT_ENV_ACCOUNT = 'AIOS_SERVICE_ACCOUNT_PATH';
const DEFAULT_ENV_SPREADSHEET = 'AIOS_DASHBOARD_SPREADSHEET_ID';
const DEFAULT_ENV_SHEET = 'AIOS_RUNLOG_SHEET_NAME';
const DEFAULT_ENV_WRITE = 'AIOS_RUNLOG_SHEET_WRITE';

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, '');
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function loadJson(filePath) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`JSON file not found: ${fullPath}`);
  }
  const raw = stripBom(readFileSync(fullPath, 'utf8'));
  return JSON.parse(raw);
}

export function getConfig(args = {}) {
  return {
    spreadsheetId: args['spreadsheet-id'] || process.env[DEFAULT_ENV_SPREADSHEET] || '',
    sheetName: args['sheet-name'] || process.env[DEFAULT_ENV_SHEET] || DEFAULT_SHEET_NAME,
    serviceAccountPath: args['service-account'] || process.env[DEFAULT_ENV_ACCOUNT] || '',
    shouldWrite: args.write === 'true' || process.env[DEFAULT_ENV_WRITE] === '1',
  };
}

export function loadServiceAccount(filePath) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`service_account.json not found: ${fullPath}`);
  }
  const account = JSON.parse(stripBom(readFileSync(fullPath, 'utf8')));
  if (!account.client_email || !account.private_key || !account.token_uri) {
    throw new Error(`Invalid service account file: ${fullPath}`);
  }
  return { account, fullPath };
}

function createJwt({ clientEmail, privateKey, tokenUri, scope }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope,
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${signingInput}.${signature}`;
}

export async function fetchAccessToken(account) {
  const assertion = createJwt({
    clientEmail: account.client_email,
    privateKey: account.private_key,
    tokenUri: account.token_uri,
    scope: DEFAULT_SCOPE,
  });

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(account.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to obtain access token (${response.status}): ${text}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('Access token response did not include access_token');
  }
  return payload.access_token;
}

export async function getAuthorizedContext(args = {}) {
  const config = getConfig(args);
  if (!config.spreadsheetId) {
    throw new Error(`Spreadsheet ID is missing. Set ${DEFAULT_ENV_SPREADSHEET} or pass --spreadsheet-id.`);
  }
  if (!config.serviceAccountPath) {
    throw new Error(`Service account path is missing. Set ${DEFAULT_ENV_ACCOUNT} or pass --service-account.`);
  }
  const { account, fullPath } = loadServiceAccount(config.serviceAccountPath);
  const accessToken = await fetchAccessToken(account);
  return {
    ...config,
    accessToken,
    account,
    serviceAccountFile: basename(fullPath),
  };
}

async function sheetsFetch(url, { accessToken, method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${text}`);
  }

  return response.json();
}

export async function getSpreadsheetMetadata({ spreadsheetId, accessToken }) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title,index,gridProperties))`;
  return sheetsFetch(url, { accessToken });
}

export async function getSheetValues({ spreadsheetId, sheetName, range = '1:3', accessToken }) {
  const encodedRange = encodeURIComponent(`${sheetName}!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
  return sheetsFetch(url, { accessToken });
}

export async function updateSheetValues({ spreadsheetId, sheetName, range, values, accessToken }) {
  const encodedRange = encodeURIComponent(`${sheetName}!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, {
    accessToken,
    method: 'PUT',
    body: {
      majorDimension: 'ROWS',
      values,
    },
  });
}

export async function appendSheetRow({ spreadsheetId, sheetName, row, accessToken }) {
  const range = encodeURIComponent(`${sheetName}!A:J`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsFetch(url, {
    accessToken,
    method: 'POST',
    body: {
      majorDimension: 'ROWS',
      values: [row],
    },
  });
}

export {
  DEFAULT_ENV_ACCOUNT,
  DEFAULT_ENV_SPREADSHEET,
  DEFAULT_ENV_SHEET,
  DEFAULT_ENV_WRITE,
  DEFAULT_SHEET_NAME,
};
