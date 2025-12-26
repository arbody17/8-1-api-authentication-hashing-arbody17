#!/usr/bin/env node
/**
 * Lab 8-1-api-authentication-hashing — Autograder (grade.cjs)
 *
 * Scoring:
 * - TODO 1 (Register): 30
 * - TODO 2 (Login):    30
 * - TODO 3 (Weather):  20
 * - Tasks total:       80
 * - Submission:        20 (on-time=20, late=10, missing/empty server.js=0)
 * - Total:            100
 *
 * Due date: 11/24/2025 11:59 PM Riyadh (UTC+03:00)
 *
 * IMPORTANT (late check) — FIXED:
 * - Use the latest repo commit (HEAD) timestamp and compare to due date.
 * - If HEAD <= due: status=0, submission=20
 * - If HEAD  > due: status=1, submission=10
 * - If missing/empty required file: status=2, submission=0
 *
 * Outputs:
 * - artifacts/grade.csv  (structure unchanged)
 * - artifacts/feedback/README.md
 * - GitHub Actions Step Summary (GITHUB_STEP_SUMMARY)
 *
 * NOTE: In your workflow, make sure checkout uses full history:
 *   uses: actions/checkout@v4
 *   with: { fetch-depth: 0 }
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const LAB_NAME = "8-1-api-authentication-hashing";

const ARTIFACTS_DIR = "artifacts";
const FEEDBACK_DIR = path.join(ARTIFACTS_DIR, "feedback");
fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

/** Due date: 11/24/2025 11:59 PM Riyadh (UTC+03:00) */
const DUE_ISO = "2025-11-24T23:59:00+03:00";
const DUE_EPOCH_MS = Date.parse(DUE_ISO);

/** Required file is in repo root */
const REQUIRED_SERVER_PATH = "server.js";

/** ---------- Student ID ---------- */
function getStudentId() {
  const repoFull = process.env.GITHUB_REPOSITORY || ""; // org/repo
  const repoName = repoFull.includes("/") ? repoFull.split("/")[1] : repoFull;
  const fromRepoSuffix =
    repoName && repoName.includes("-")
      ? repoName.split("-").slice(-1)[0]
      : "";
  return (
    process.env.STUDENT_USERNAME ||
    fromRepoSuffix ||
    process.env.GITHUB_ACTOR ||
    repoName ||
    "student"
  );
}

/** ---------- Git helpers: latest repo commit time (HEAD) ---------- */
function getHeadCommitInfo() {
  try {
    const out = execSync("git log -1 --format=%H|%ct|%an|%ae|%s", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    if (!out) return null;

    const [sha, ct, an, ae, ...subjParts] = out.split("|");
    const seconds = Number(ct);
    const epochMs = Number.isFinite(seconds) ? seconds * 1000 : null;

    return {
      sha: sha || "unknown",
      epochMs,
      iso: epochMs ? new Date(epochMs).toISOString() : "unknown",
      author: an || "unknown",
      email: ae || "unknown",
      subject: subjParts.join("|") || "",
    };
  } catch {
    return null;
  }
}

function wasSubmittedLateStrict(headEpochMs) {
  // If we cannot read time, treat as late (prevents incorrectly giving on-time)
  if (!headEpochMs) return true;
  return headEpochMs > DUE_EPOCH_MS;
}

/** ---------- File helpers ---------- */
function readTextSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function stripJsComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function compactWs(s) {
  return s.replace(/\s+/g, " ").trim();
}

function isEmptyCode(code) {
  const stripped = compactWs(stripJsComments(code));
  return stripped.length < 10;
}

/** ---------- Very light “top-level” detectors (keep it simple) ---------- */
function hasRegex(code, re) {
  try {
    return re.test(code);
  } catch {
    return false;
  }
}

function any(code, regexes) {
  return regexes.some((re) => hasRegex(code, re));
}

/** TODO 1 (Register) - simple checks */
function checkRegister(code) {
  const reqs = [];

  const hasRoute = any(code, [
    /app\s*\.\s*post\s*\(\s*["'`]\/register["'`]\s*,/i,
    /router\s*\.\s*post\s*\(\s*["'`]\/register["'`]\s*,/i,
  ]);

  const readsBody = any(code, [
    /const\s*\{\s*email\s*,\s*password\s*\}\s*=\s*req\.body\s*\|\|\s*\{\s*\}\s*;/i,
    /req\.body/i,
  ]);

  const missingFields400 = any(code, [
    /Email and password are required/i,
    /status\s*\(\s*400\s*\)\s*\.json/i,
  ]);

  const checksExisting = any(code, [
    /users\s*\.find\s*\(/i,
    /User already exists/i,
  ]);

  const bcryptHash = any(code, [
    /bcrypt\s*\.\s*hash\s*\(\s*password\s*,\s*10\s*\)/i,
    /await\s+bcrypt\s*\.\s*hash/i,
  ]);

  const pushesUser = any(code, [
    /users\s*\.push\s*\(/i,
    /passwordHash/i,
  ]);

  const success201 = any(code, [
    /status\s*\(\s*201\s*\)\s*\.json/i,
    /User registered!/i,
  ]);

  const hasTryCatch = any(code, [
    /try\s*\{[\s\S]*\}\s*catch\s*\(\s*\w+\s*\)\s*\{/i,
    /Register error:/i,
    /Server error during register/i,
  ]);

  reqs.push({ label: 'Defines POST "/register" route', ok: hasRoute });
  reqs.push({ label: "Reads { email, password } from req.body", ok: readsBody });
  reqs.push({ label: 'Validates missing fields -> 400 required error', ok: missingFields400 });
  reqs.push({ label: "Checks if user already exists", ok: checksExisting });
  reqs.push({ label: "Hashes password with bcrypt", ok: bcryptHash });
  reqs.push({ label: "Stores new user in users[] with passwordHash", ok: pushesUser });
  reqs.push({ label: "Returns success (201) message", ok: success201 });
  reqs.push({ label: "Has try/catch with 500 error on crash", ok: hasTryCatch });

  const passed = reqs.filter((r) => r.ok).length;
  const total = reqs.length;
  const earned = Math.round((30 * passed) / total);

  return { earned, max: 30, reqs };
}

/** TODO 2 (Login) - simple checks */
function checkLogin(code) {
  const reqs = [];

  const hasRoute = any(code, [
    /app\s*\.\s*post\s*\(\s*["'`]\/login["'`]\s*,/i,
    /router\s*\.\s*post\s*\(\s*["'`]\/login["'`]\s*,/i,
  ]);

  const readsBody = any(code, [
    /const\s*\{\s*email\s*,\s*password\s*\}\s*=\s*req\.body\s*\|\|\s*\{\s*\}\s*;/i,
    /req\.body/i,
  ]);

  const missingFields400 = any(code, [
    /Email and password are required/i,
    /status\s*\(\s*400\s*\)\s*\.json/i,
  ]);

  const findsUser = any(code, [
    /users\s*\.find\s*\(/i,
    /User not found/i,
  ]);

  const bcryptCompare = any(code, [
    /bcrypt\s*\.\s*compare\s*\(/i,
    /passwordHash/i,
  ]);

  const wrongPassword400 = any(code, [
    /Wrong password/i,
    /status\s*\(\s*400\s*\)\s*\.json/i,
  ]);

  const jwtSign = any(code, [
    /jwt\s*\.\s*sign\s*\(/i,
    /expiresIn\s*:\s*["'`]1h["'`]/i,
  ]);

  const secretAbc123 = any(code, [
    /JWT_SECRET\s*=\s*["'`]abc123["'`]/i,
  ]);

  const returnsToken = any(code, [
    /res\s*\.json\s*\(\s*\{\s*token\s*\}\s*\)/i,
  ]);

  const hasTryCatch = any(code, [
    /try\s*\{[\s\S]*\}\s*catch\s*\(\s*\w+\s*\)\s*\{/i,
    /Login error:/i,
    /Server error during login/i,
  ]);

  reqs.push({ label: 'Defines POST "/login" route', ok: hasRoute });
  reqs.push({ label: "Reads { email, password } from req.body", ok: readsBody });
  reqs.push({ label: "Validates missing fields (400)", ok: missingFields400 });
  reqs.push({ label: "Finds user by email / handles user-not-found", ok: findsUser });
  reqs.push({ label: "Compares passwords with bcrypt.compare()", ok: bcryptCompare });
  reqs.push({ label: "Handles wrong password (400)", ok: wrongPassword400 });
  reqs.push({ label: "Creates JWT token with expiresIn=1h", ok: jwtSign });
  reqs.push({ label: 'Uses JWT secret "abc123"', ok: secretAbc123 });
  reqs.push({ label: "Returns { token }", ok: returnsToken });
  reqs.push({ label: "Has try/catch with 500 error on crash", ok: hasTryCatch });

  const passed = reqs.filter((r) => r.ok).length;
  const total = reqs.length;
  const earned = Math.round((30 * passed) / total);

  return { earned, max: 30, reqs };
}

/** TODO 3 (Weather) - simple checks */
function checkWeather(code) {
  const reqs = [];

  const hasRoute = any(code, [
    /app\s*\.\s*get\s*\(\s*["'`]\/weather["'`]\s*,/i,
    /router\s*\.\s*get\s*\(\s*["'`]\/weather["'`]\s*,/i,
  ]);

  const readsAuthHeader = any(code, [
    /req\s*\.headers\s*\.authorization/i,
    /const\s+auth\s*=\s*req\s*\.headers\s*\.authorization/i,
  ]);

  const missingToken401 = any(code, [
    /Missing token/i,
    /status\s*\(\s*401\s*\)\s*\.json/i,
  ]);

  const extractsBearer = any(code, [
    /auth\s*\.split\s*\(\s*["'` ]+["'`]\s*\)\s*\[\s*1\s*\]/i,
    /\bBearer\b/i,
  ]);

  const verifiesJwt = any(code, [
    /jwt\s*\.verify\s*\(\s*token\s*,\s*JWT_SECRET\s*\)/i,
    /Invalid token/i,
  ]);

  const readsCity = any(code, [
    /req\s*\.query\s*\.city/i,
    /const\s+city\s*=\s*req\s*\.query\s*\.city/i,
  ]);

  const cityRequired400 = any(code, [
    /City required/i,
    /status\s*\(\s*400\s*\)\s*\.json/i,
  ]);

  const callsApi = any(code, [
    /goweather\.herokuapp\.com\/weather/i,
    /encodeURIComponent\s*\(\s*city\s*\)/i,
    /await\s+fetch\s*\(/i,
    /fetch\s*\(\s*url\s*\)/i,
  ]);

  const returnsStructured = any(code, [
    /return\s+res\s*\.json\s*\(\s*\{\s*city\s*,/i,
    /\btemp\s*:\s*data\s*\.temperature\b/i,
    /\bdescription\s*:\s*data\s*\.description\b/i,
    /\bwind\s*:\s*data\s*\.wind\b/i,
    /\braw\s*:\s*data\b/i,
  ]);

  const hasWeatherError500 = any(code, [
    /Error from weather API/i,
    /Server error during weather fetch/i,
    /status\s*\(\s*500\s*\)\s*\.json/i,
  ]);

  reqs.push({ label: 'Defines GET "/weather" route', ok: hasRoute });
  reqs.push({ label: "Reads Authorization header", ok: readsAuthHeader });
  reqs.push({ label: "Missing token -> 401", ok: missingToken401 });
  reqs.push({ label: "Extracts Bearer token", ok: extractsBearer });
  reqs.push({ label: "Verifies JWT / handles invalid token", ok: verifiesJwt });
  reqs.push({ label: "Reads city from query", ok: readsCity });
  reqs.push({ label: "Missing city -> 400", ok: cityRequired400 });
  reqs.push({ label: "Calls external weather API via fetch()", ok: callsApi });
  reqs.push({ label: "Returns structured weather JSON", ok: returnsStructured });
  reqs.push({ label: "Handles API/server errors with 500", ok: hasWeatherError500 });

  const passed = reqs.filter((r) => r.ok).length;
  const total = reqs.length;
  const earned = Math.round((20 * passed) / total);

  return { earned, max: 20, reqs };
}

/** ---------- Locate submission file ---------- */
const studentId = getStudentId();
const serverPath = REQUIRED_SERVER_PATH;
const hasServer = fs.existsSync(serverPath) && fs.statSync(serverPath).isFile();
const serverCode = hasServer ? readTextSafe(serverPath) : "";
const serverEmpty = hasServer ? isEmptyCode(serverCode) : true;

const fileNote = hasServer
  ? serverEmpty
    ? `⚠️ Found \`${serverPath}\` but it appears empty (or only comments).`
    : `✅ Found \`${serverPath}\`.`
  : `❌ Required file not found: \`${serverPath}\`.`;

/** ---------- Submission validation (FIXED) ---------- */
const headInfo = getHeadCommitInfo();

let status = 0;
if (!hasServer || serverEmpty) status = 2;
else status = wasSubmittedLateStrict(headInfo ? headInfo.epochMs : null) ? 1 : 0;

const submissionMarks = status === 2 ? 0 : status === 1 ? 10 : 20;

const submissionStatusText =
  status === 2
    ? "No submission detected (missing/empty server.js): submission marks = 0/20."
    : status === 1
      ? `Late submission (latest repo commit is after due): 10/20. (HEAD: ${headInfo ? headInfo.sha : "unknown"} @ ${headInfo ? headInfo.iso : "unknown"})`
      : `On-time submission (latest repo commit is within due): 20/20. (HEAD: ${headInfo ? headInfo.sha : "unknown"} @ ${headInfo ? headInfo.iso : "unknown"})`;

/** ---------- Grade TODOs ---------- */
let todo1 = { earned: 0, max: 30, reqs: [] };
let todo2 = { earned: 0, max: 30, reqs: [] };
let todo3 = { earned: 0, max: 20, reqs: [] };

if (status === 2) {
  const r = [{ label: "No submission / empty server.js → cannot grade TODOs", ok: false }];
  todo1.reqs = r;
  todo2.reqs = r;
  todo3.reqs = r;
} else {
  todo1 = checkRegister(serverCode);
  todo2 = checkLogin(serverCode);
  todo3 = checkWeather(serverCode);
}

const earnedTasks = todo1.earned + todo2.earned + todo3.earned;
const totalEarned = Math.min(earnedTasks + submissionMarks, 100);

/** ---------- Feedback formatting ---------- */
function formatReqs(reqs) {
  return reqs.map((r) => (r.ok ? `- ✅ ${r.label}` : `- ❌ ${r.label}`)).join("\n");
}

/** ---------- Build Summary ---------- */
const now = new Date().toISOString();

let summary = `# Lab | ${LAB_NAME} | Autograding Summary

- Student: \`${studentId}\`
- ${fileNote}
- ${submissionStatusText}
- Due (Riyadh): \`${DUE_ISO}\`

- Repo HEAD commit:
  - SHA: \`${headInfo ? headInfo.sha : "unknown"}\`
  - Author: \`${headInfo ? headInfo.author : "unknown"}\` <${headInfo ? headInfo.email : "unknown"}>
  - Time (UTC ISO): \`${headInfo ? headInfo.iso : "unknown"}\`

- Status: **${status}** (0=on time, 1=late, 2=no submission/empty)
- Run: \`${now}\`

## Marks Breakdown

| Item | Marks |
|------|------:|
| TODO 1: User Registration (POST /register) | ${todo1.earned}/${todo1.max} |
| TODO 2: User Login (POST /login) | ${todo2.earned}/${todo2.max} |
| TODO 3: Protected Weather (GET /weather) | ${todo3.earned}/${todo3.max} |
| Submission | ${submissionMarks}/20 |

## Total Marks

**${totalEarned} / 100**

## Detailed Feedback

### TODO 1: User Registration (POST /register)
${formatReqs(todo1.reqs)}

### TODO 2: User Login (POST /login)
${formatReqs(todo2.reqs)}

### TODO 3: Protected Weather (GET /weather)
${formatReqs(todo3.reqs)}
`;

/** ---------- Write outputs ---------- */
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

/** DO NOT change CSV structure */
const csv = `student_username,obtained_marks,total_marks,status
${studentId},${totalEarned},100,${status}
`;

fs.writeFileSync(path.join(ARTIFACTS_DIR, "grade.csv"), csv);
fs.writeFileSync(path.join(FEEDBACK_DIR, "README.md"), summary);

console.log(`✔ Lab graded: ${totalEarned}/100 (status=${status})`);
