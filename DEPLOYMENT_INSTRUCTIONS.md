# 🔴 URGENT: CyberWolf Relay Redeploy Required

## Status Report

### ✅ What's Working
| Component | Status | Details |
|-----------|--------|---------|
| Dashboard JS (loadRemoteState fix) | ✅ FIXED | Commit `6d4237f` — IIFE bug resolved |
| Sync button feature | ✅ LIVE | Commit `9debb0e` — cross-device sync added |
| Relay URL in dashboard.js | ✅ UPDATED | Commit `e51272f` — pointing to current deploy |
| GET /heartbeat on deployed relay | ✅ WORKING | Returns JSON responses fine |

### 🔴 What's Broken
| Component | Problem | Root Cause |
|-----------|---------|------------|
| POST /sync via CORS | ❌ BLOCKED | Current deploy lacks `doOptions()` handler |

### Diagnostic Evidence

**OPTIONS preflight test against current URL:**
```
$ curl -v -X OPTIONS ".../exec" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type"

< HTTP/2 405
< content-type: text/html; charset=UTF-8
< server: GSE

<!-- GSE Default Error -->
<H1>Method Not Allowed</H1>
```

**Conclusion:** Google Apps Script's default handler returns 405 for OPTIONS because the currently deployed version does NOT include `doOptions()`. The browser cancels the fetch before even sending the POST body. All POST/cross-origin requests are dead until redeploy.

---

## Deployment Checklist for Sophia

### Prerequisites
- [ ] Access to Google account that owns the "CyberWolf-Sync" spreadsheet
- [ ] Apps Script editor open (or navigate: Sheet → Extensions → Apps Script)

### Step-by-Step

1. **Open Apps Script**
   - Go to your Google Sheet "CyberWolf-Sync"
   - Menu: **Extensions → Apps Script**

2. **Clear old code**
   - Select ALL code in the editor (`Ctrl+A` / `Cmd+A`)
   - Delete it completely
   - Verify the editor is blank

3. **Paste v8 CORS-fixed code**
   - Copy the ENTIRE contents of `/tmp/final_relay_code_final.txt` (or the code block below)
   - Paste into the Apps Script editor
   - ⚠️ PASTE EVERYTHING including the comment block at the top

4. **Save the project**
   - Menu: **File → Save**
   - Project name: `CyberWolf-Sync-Relay`

5. **Create new deployment**
   - Menu: **Deploy → New deployment**
   - Click the gear icon ⚙️ next to "Select type" → Choose **Web app**
   - Configure:
     - **Description:** `v8 CORS fixed — POST support`
     - **Execute as:** `Me` (your email)
     - **Who has access:** `Anyone`
   - Click **Deploy**

6. **Authorize**
   - Click **Authorize access** when prompted
   - Review permissions → **Advanced → Go to CyberWolf-Sync-Relay (unsafe)** → **Allow**

7. **Copy NEW Web App URL**
   - After deployment succeeds, you'll see a URL like:
     ```
     https://script.google.com/macros/s/AKfycYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec
     ```
   - **COPY THIS URL** — this is your NEW relay endpoint

8. **Test the new deployment**
   Run this in terminal to verify CORS:
   ```bash
   curl -v -X OPTIONS "YOUR_NEW_URL_HERE" \
     -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type"
   ```
   Expected: Should return `HTTP/2 204` with `Access-Control-Allow-Origin` header
   If it still returns 405, something went wrong in step 3.

9. **Update dashboard.js**
   - Open `/root/CyberWolf_Dashboard/dashboard.js`
   - Find line 11: `const CYBERWOLF_RELAY_URL = '...'`
   - Replace the OLD URL with the NEW URL from step 7
   - Save and commit:
     ```bash
     cd /root/CyberWolf_Dashboard
     git add dashboard.js
     git commit -m "feat: update relay URL to v8 CORS-fix deploy"
     git push origin main
     ```

10. **Verify end-to-end**
    - Navigate to your hosted dashboard page
    - Open browser DevTools Console (F12)
    - Complete a task
    - Look for `POST .../exec` in Network tab — should show `200 OK` (not CORS error)
    - Check the Google Sheet "Sync" tab — should see a new row appear

---

## Exact Code to Paste (v8 — CORS Fixed)

```javascript
/**
 * CyberWolf Dashboard — Google Sheets Bridge Relay (v8 — CORS FIXED)
 * 
 * Server-side Apps Script middleware between browser dashboard
 * and Google Sheets. Handles JSON parsing, task sync.
 * 
 * v8 FIXES:
 *   - Added doOptions() for browser CORS preflight support (critical!)
 *     Browsers send OPTIONS before POST with JSON Content-Type.
 *     Without doOptions, the preflight returns 405 HTML → fetch() cancelled.
 *   - Fixed fetch URLs in dashboard.js to use ?action=xxx (no path segments).
 *     Apps Script receives e.pathInfo unpredictably — query params are reliable.
 *   - getUserState() now builds { completedTaskIds, lastUpdated } format
 *     matching dashboard's loadRemoteState() expectations.
 *   - Using e.parameters directly (Google-built) + manual e.queryString fallback.
 */

// ─── Constants ──────────────────────────────────────────────
var SHEET_NAME = 'Sync';
var SYNC_COLUMNS = ['userId', 'deviceId', 'taskId', 'taskLabel', 'completed', 'completedBy', 'timestamp', 'version'];
var MAX_AGE_SECONDS = 3600; // Cache preflight result for 1 hour

// ─── CORS Preflight Handler (NEW in v8) ────────────────────
function doOptions(e) {
  var origin = '';
  if (e && e.header && e.header['Origin']) {
    origin = e.header['Origin'];
  }
  
  var output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  
  output.setHeader('Access-Control-Allow-Origin', origin || '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.setHeader('Access-Control-Max-Age', String(MAX_AGE_SECONDS));
  
  return output;
}

// ─── Entry Points ──────────────────────────────────────────

function doGet(e) {
  var p = getParameters(e);
  try {
    if (p.action === 'state') {
      return jsonResp(getUserState(p.userId));
    } else if (p.action === 'heartbeat') {
      return jsonResp({ status: 'ok', rows: getRowCount() });
    }
    return jsonResp({ error: 'unknown action' });
  } catch (err) {
    return jsonResp({ error: 'doGet failed', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.getDataAsString());
    if (!body.userId || !body.deviceId || !body.taskId) {
      return jsonResp({ error: 'missing fields', required: ['userId','deviceId','taskId'] });
    }
    var result = processSync(body);
    return jsonResp({ ok: true, taskId: body.taskId, version: result.version });
  } catch (err) {
    return jsonResp({ error: 'doPost failed', message: err.toString() });
  }
}

// ─── Core Logic ────────────────────────────────────────────

function getUserState(userId) {
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  var taskMap = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rUserId = String(row[0] || '');
    var rTaskId = String(row[2] || '');
    var rVersion = Number(row[7] || 0);
    
    if (rUserId !== userId) continue;
    if (!taskMap[rTaskId] || rVersion > taskMap[rTaskId].version) {
      taskMap[rTaskId] = {
        id: rTaskId,
        label: String(row[3] || rTaskId),
        completed: row[4] === true || row[4] == 'TRUE' || row[4] == 'True',
        timestamp: formatTS(row[6]),
        version: rVersion
      };
    }
  }
  
  var completedTasks = [];
  var latestTS = '';
  for (var key in taskMap) {
    var t = taskMap[key];
    if (t.completed) {
      completedTasks.push(t.id);
    }
    if (t.timestamp > latestTS) {
      latestTS = t.timestamp;
    }
  }
  
  return {
    userId: userId,
    completedTaskIds: completedTasks,
    lastUpdated: latestTS,
    deviceCount: Object.keys(taskMap).length
  };
}

function processSync(event) {
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  var existingRow = -1;
  var maxVer = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === event.userId && String(data[i][2]) === event.taskId) {
      var v = Number(data[i][7] || 0);
      if (v >= maxVer) { maxVer = v; existingRow = i + 1; }
    }
  }
  
  var newRow = [
    event.userId,
    event.deviceId,
    event.taskId,
    event.taskLabel || event.taskId,
    event.completed ? true : false,
    event.deviceId,
    new Date(),
    maxVer + 1
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, newRow.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }
  
  return { version: maxVer + 1, updated: existingRow > 0 };
}

// ─── Helpers ───────────────────────────────────────────────

function getParameters(e) {
  var params = {};
  if (e && e.parameters) {
    for (var key in e.parameters) {
      params[key] = String(e.parameters[key]);
    }
  }
  if (Object.keys(params).length === 0 && e && e.queryString) {
    e.queryString.split('&').forEach(function(pair) {
      var kv = pair.split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
  }
  return params;
}

function parseParams(e) {
  return getParameters(e);
}

function getOrCreateSheet() {
  var ss;
  var id = PropertiesService.getScriptProperties().getProperty('sheetId');
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('CyberWolf-Sync');
    PropertiesService.getScriptProperties().setProperty('sheetId', ss.getId());
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(SYNC_COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getRowCount() {
  return getOrCreateSheet().getDataRange().getNumRows() - 1;
}

function formatTS(ts) {
  try {
    if (ts instanceof Date) return ts.toISOString();
    return String(ts);
  } catch(e) { return String(ts); }
}

function jsonResp(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
```

---

## Rollback Plan (if something breaks)

If the new deployment doesn't work, revert to this known-good commit:
```bash
cd /root/CyberWolf_Dashboard
git checkout 70cc285 -- dashboard.js  # last relay URL commit
```

Or temporarily disable cross-device sync by commenting out the fetch calls in `dashboard.js` that call `CYBERWOLF_RELAY_URL` — the dashboard will fall back to localStorage-only mode.
