// ============================================================
//  Sales Dashboard — Excel Parser (SheetJS)
//  v4 — Universal Date Engine, Intelligent Column Scorer,
//       Data-level Column Auto-Discovery, Timezone-Safe Local Dates
// ============================================================

const Parser = (() => {

  // ----------------------------------------------------------
  //  Date utilities
  // ----------------------------------------------------------

  function _localDate(yr, mo, dy, hr = 0, min = 0, sec = 0) {
    if (yr < 1900 || yr > 2100 || mo < 1 || mo > 12 || dy < 1 || dy > 31) return null;
    const d = new Date(yr, mo - 1, dy, hr, min, sec, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const MONTH_MAP = {
    jan:0, feb:1, mar:2, apr:3, may:4,  jun:5,
    jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  };

  /**
   * Universal Date Parser.
   * Handles:
   *  - Native JS Date (from SheetJS cellDates:true)
   *  - Excel numeric serials (e.g. 46307, "46307")
   *  - Relative day counts (e.g. 5 -> 5 days ago)
   *  - Relative text: "today", "yesterday", "3 days ago", "3d ago"
   *  - ISO: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
   *  - Named months with year: DD-Mon-YYYY, DD Mon YYYY, Mon DD YYYY, Mon DD, YYYY
   *  - Named months without year: DD-Mon, Mon DD (defaults to current year)
   *  - 3-part numeric: MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY, DD-MM-YYYY, DD.MM.YYYY
   *  - 2-part numeric: MM/DD, DD/MM (defaults to current year)
   *  - Datetime strings with timestamps: "10/12/2026 12:00:00 AM", "12/10/2026 14:30"
   *  - Embedded dates in text: "Call on 10/12/2026", "Last meeting held: 12-Oct-2026"
   */
  function toDate(val) {
    if (val === null || val === undefined || val === '') return null;

    // 1. JS Date
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return _localDate(
        val.getUTCFullYear(),
        val.getUTCMonth() + 1,
        val.getUTCDate(),
        val.getUTCHours(),
        val.getUTCMinutes(),
        val.getUTCSeconds()
      ) || val;
    }

    // 2. Numeric input: Excel serial (>= 1000) or Days Ago (<= 365)
    if (typeof val === 'number' && !isNaN(val)) {
      if (val >= 1000 && val <= 2958466) {
        const days = Math.floor(val);
        const frac = val - days;
        const d = new Date(1899, 11, 30 + days);
        if (!isNaN(d.getTime())) {
          if (frac > 0.0001) {
            const totalSec = Math.round(frac * 86400);
            d.setHours(Math.floor(totalSec / 3600), Math.floor((totalSec % 3600) / 60), totalSec % 60, 0);
          } else {
            d.setHours(0, 0, 0, 0);
          }
          return d;
        }
      } else if (val >= 0 && val <= 365) {
        const d = new Date();
        d.setDate(d.getDate() - Math.floor(val));
        d.setHours(0, 0, 0, 0);
        return d;
      }
      return null;
    }

    const str = String(val).trim();
    if (!str) return null;

    // Numeric string Excel serial (e.g. "46307")
    if (/^\d{4,6}(\.\d+)?$/.test(str)) {
      const num = parseFloat(str);
      if (num >= 1000 && num <= 2958466) {
        return toDate(num);
      }
    }

    // Relative strings: today, yesterday, N days ago
    const lower = str.toLowerCase();
    if (lower === 'today') {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    }
    if (lower === 'yesterday') {
      const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d;
    }
    const relDays = lower.match(/^(\d+)\s*(?:days?|d)(?:\s*ago)?$/);
    if (relDays) {
      const d = new Date(); d.setDate(d.getDate() - parseInt(relDays[1], 10)); d.setHours(0, 0, 0, 0); return d;
    }

    const curYear = new Date().getFullYear();

    // 3. ISO format: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    const iso = str.match(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
    if (iso) {
      const d = _localDate(+iso[1], +iso[2], +iso[3]);
      if (d) return d;
    }

    // 4. Named month with year: DD-Mon-YYYY or DD Mon YYYY
    const dMonY = str.match(/\b(\d{1,2})[\s\-\/\.]([a-z]{3,9})[\s\-\/\.]*(\d{2,4})\b/i);
    if (dMonY) {
      const mo = MONTH_MAP[dMonY[2].toLowerCase().slice(0, 3)];
      if (mo !== undefined) {
        let yr = +dMonY[3];
        if (yr < 100) yr += (yr < 50 ? 2000 : 1900);
        const d = _localDate(yr, mo + 1, +dMonY[1]);
        if (d) return d;
      }
    }

    // 5. Named month with year: Mon DD, YYYY or Mon DD YYYY
    const monDY = str.match(/\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{2,4})\b/i);
    if (monDY) {
      const mo = MONTH_MAP[monDY[1].toLowerCase().slice(0, 3)];
      if (mo !== undefined) {
        let yr = +monDY[3];
        if (yr < 100) yr += (yr < 50 ? 2000 : 1900);
        const d = _localDate(yr, mo + 1, +monDY[2]);
        if (d) return d;
      }
    }

    // 6. Named month WITHOUT year: DD-Mon, Mon DD (defaults to current year)
    const dMonNoYear = str.match(/\b(\d{1,2})[\s\-\/\.]([a-z]{3,9})\b/i);
    if (dMonNoYear) {
      const mo = MONTH_MAP[dMonNoYear[2].toLowerCase().slice(0, 3)];
      if (mo !== undefined) {
        const d = _localDate(curYear, mo + 1, +dMonNoYear[1]);
        if (d) return d;
      }
    }
    const monDNoYear = str.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})\b/i);
    if (monDNoYear) {
      const mo = MONTH_MAP[monDNoYear[1].toLowerCase().slice(0, 3)];
      if (mo !== undefined) {
        const d = _localDate(curYear, mo + 1, +monDNoYear[2]);
        if (d) return d;
      }
    }

    // 7. Numeric 3-part date: X/Y/Z or X-Y-Z or X.Y.Z
    const numDate = str.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
    if (numDate) {
      let n1 = +numDate[1];
      let n2 = +numDate[2];
      let yr = +numDate[3];
      if (yr < 100) yr += (yr < 50 ? 2000 : 1900);

      if (n1 > 12 && n2 <= 12) {
        const d = _localDate(yr, n2, n1);
        if (d) return d;
      } else if (n2 > 12 && n1 <= 12) {
        const d = _localDate(yr, n1, n2);
        if (d) return d;
      } else if (n1 <= 12 && n2 <= 31) {
        const d = _localDate(yr, n1, n2);
        if (d) return d;
      }
    }

    // 8. Numeric 2-part date: MM/DD or DD/MM (without year -> curYear)
    const num2 = str.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
    if (num2) {
      let n1 = +num2[1];
      let n2 = +num2[2];
      if (n1 > 12 && n2 <= 12) {
        const d = _localDate(curYear, n2, n1);
        if (d) return d;
      } else if (n1 <= 12 && n2 <= 31) {
        const d = _localDate(curYear, n1, n2);
        if (d) return d;
      }
    }

    // 9. Native JS Date fallback
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  /**
   * Extract all dates found in free text (activity logs, meeting notes, etc.).
   */
  function extractDatesFromText(text) {
    if (!text) return [];
    const str   = String(text);
    const found = [];
    const seen  = new Set();

    const push = (d) => {
      if (!d || isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!seen.has(key)) { seen.add(key); found.push(d); }
    };

    // First try parsing directly
    const direct = toDate(text);
    if (direct) push(direct);

    // Also look for ISO
    for (const m of str.matchAll(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g)) {
      push(_localDate(+m[1], +m[2], +m[3]));
    }

    // DD-Mon-YYYY
    for (const m of str.matchAll(/\b(\d{1,2})[\s\-\/\.]([a-z]{3,9})[\s\-\/\.]*(\d{2,4})\b/gi)) {
      const mo = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
      let yr = +m[3];
      if (yr < 100) yr += (yr < 50 ? 2000 : 1900);
      if (mo !== undefined) push(_localDate(yr, mo + 1, +m[1]));
    }

    // Mon DD, YYYY
    for (const m of str.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{2,4})\b/gi)) {
      const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
      let yr = +m[3];
      if (yr < 100) yr += (yr < 50 ? 2000 : 1900);
      if (mo !== undefined) push(_localDate(yr, mo + 1, +m[2]));
    }

    // Numeric dates
    for (const m of str.matchAll(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g)) {
      let n1 = +m[1];
      let n2 = +m[2];
      let yr = +m[3];
      if (yr < 100) yr += (yr < 50 ? 2000 : 1900);

      if (n1 > 12 && n2 <= 12) {
        push(_localDate(yr, n2, n1));
      } else if (n2 > 12 && n1 <= 12) {
        push(_localDate(yr, n1, n2));
      } else if (n1 <= 12 && n2 <= 31) {
        push(_localDate(yr, n1, n2));
      }
    }

    return found;
  }

  function latestDateFromText(text) {
    const dates = extractDatesFromText(text);
    if (!dates.length) return null;

    // A meeting *held* is in the past or today (allow +1 day for timezone drift)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 1);
    cutoff.setHours(23, 59, 59, 999);

    const pastOrPresent = dates.filter(d => d <= cutoff);
    const pool = pastOrPresent.length > 0 ? pastOrPresent : dates;
    return pool.reduce((max, d) => (d > max ? d : max), pool[0]);
  }

  // ----------------------------------------------------------
  //  Number utility
  // ----------------------------------------------------------
  function toNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // ----------------------------------------------------------
  //  Intelligent Header Detection & Column Scorer
  // ----------------------------------------------------------

  function detectHeaderRow(rows) {
    const keywords = [
      /ae[-_\s]?primary|opp.*owner|owner\b|sales\s*rep/i,
      /opp(ortunity)?\s*name|deal\s*name/i,
      /^stage|deal\s*stage/i,
      /\barr\b|annual\s*recurring|amount|deal\s*value/i,
      /close\s*date|target\s*close|expected\s*close/i,
      /interaction|last\s*activity|activity\s*history|last\s*touch|last\s*meeting|meeting\s*held/i,
      /next\s*step\s*date/i,
      /next\s*step/i,
      /stage\s*duration|days?\s*in\s*stage/i,
      /^age\b|deal\s*age|opp.*age/i,
    ];

    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      let score = 0;
      row.forEach(cell => {
        const str = String(cell || '').trim();
        if (!str) return;
        if (keywords.some(rx => rx.test(str))) score++;
      });
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    return bestScore >= 2 ? bestIdx : 0;
  }

  function mapColumns(headerRow) {
    const cols = { ...CONFIG.COLS, ACCOUNT_NAME: 2 };

    const cleanHeaders = headerRow.map(cell => {
      return String(cell || '')
        .toLowerCase()
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\w\s\-\/\(\)]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    });

    const fieldRules = {
      AE_PRIMARY: {
        strong: [/ae[-_\s]?primary/i, /opportunity\s*owner/i, /owner\s*full\s*name/i],
        medium: [/\bowner\b/i, /\bsales\s*rep\b/i, /\bae\b/i],
        exclude: [/account/i, /manager/i],
      },
      OPP_NAME: {
        strong: [/opportunity\s*name/i, /deal\s*name/i, /opp\s*name/i],
        medium: [/\bopportunity\b/i, /\bdeal\b/i],
        exclude: [/owner/i, /stage/i, /arr/i, /amount/i, /age/i],
      },
      ACCOUNT_NAME: {
        strong: [/account\s*name/i, /company\s*name/i, /client\s*name/i],
        medium: [/\baccount\b/i, /\bcompany\b/i, /\bclient\b/i],
        exclude: [/owner/i, /ae/i, /interaction/i],
      },
      STAGE: {
        strong: [/\bdeal\s*stage\b/i, /\bopportunity\s*stage\b/i, /^stage$/i],
        medium: [/\bstage\b/i, /\bstatus\b/i],
        exclude: [/duration/i, /days/i, /age/i, /date/i],
      },
      ARR: {
        strong: [/\barr\b/i, /annual\s*recurring\s*revenue/i],
        medium: [/\bamount\b/i, /\bdeal\s*value\b/i, /\bvalue\b/i, /\brevenue\b/i],
        exclude: [/stage/i, /age/i, /duration/i, /date/i],
      },
      CLOSE_DATE: {
        strong: [/close\s*date/i, /target\s*close/i, /expected\s*close/i, /closing\s*date/i],
        medium: [/\bclose\b/i],
        exclude: [/interaction/i, /activity/i, /next/i, /step/i],
      },
      INTERACTION_HISTORY: {
        strong: [
          /interaction\s*history/i, /last\s*interaction/i, /interaction\s*date/i,
          /last\s*activity/i, /activity\s*history/i, /last\s*meeting/i,
          /meeting\s*date/i, /meeting\s*held/i, /last\s*touch/i, /activity\s*date/i, /touchpoint/i,
        ],
        medium: [
          /\binteraction/i, /\bmeeting/i, /\bactivities/i, /\bactivity/i, /\bhistory/i,
          /last\s*contact/i, /recent\s*meeting/i, /recent\s*activity/i, /recent\s*interaction/i,
        ],
        exclude: [/next/i, /stage/i, /close/i, /owner/i, /name/i, /opp/i],
      },
      NEXT_STEP_DATE: {
        strong: [/next\s*step\s*date/i, /next\s*interaction\s*date/i, /next\s*meeting\s*date/i, /next\s*step\s*due/i, /next\s*activity\s*date/i],
        medium: [/next\s*date/i, /next\s*due/i],
        exclude: [/history/i, /last/i, /desc/i],
      },
      NEXT_STEP_DESC: {
        strong: [/next\s*step\s*desc/i, /next\s*step\s*description/i, /next\s*step\s*notes/i],
        medium: [/next\s*step/i, /next\s*action/i],
        exclude: [/date/i, /time/i, /history/i, /last/i],
      },
      STAGE_DURATION: {
        strong: [/stage\s*duration/i, /days?\s*in\s*stage/i, /stage\s*age/i],
        medium: [/duration/i],
        exclude: [/close/i, /interaction/i],
      },
      AGE: {
        strong: [/\bopportunity\s*age\b/i, /\bdeal\s*age\b/i, /^age\b/i, /\bdays\s*open\b/i],
        medium: [/\bage\b/i],
        exclude: [/stage/i, /duration/i],
      },
    };

    for (const [field, rules] of Object.entries(fieldRules)) {
      let bestIdx = -1;
      let highestScore = -1;

      cleanHeaders.forEach((header, idx) => {
        if (!header) return;
        if (rules.exclude && rules.exclude.some(rx => rx.test(header))) return;
        let score = 0;
        if (rules.strong && rules.strong.some(rx => rx.test(header))) score = 10;
        else if (rules.medium && rules.medium.some(rx => rx.test(header))) score = 5;

        if (score > highestScore) {
          highestScore = score;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1) {
        cols[field] = bestIdx;
      }
    }

    return cols;
  }

  // ----------------------------------------------------------
  //  Data-Level Column Auto-Discovery Fallback
  // ----------------------------------------------------------

  /**
   * If after header mapping, the interaction column produces 0 valid dates
   * across all data rows, scan all unmapped columns to see if another column
   * contains dates or interaction logs.
   */
  function autoDiscoverInteractionColumn(dataRows, colMap) {
    // Check how many dates are found in the current INTERACTION_HISTORY column
    let currentDatesFound = 0;
    const testSample = dataRows.slice(0, 30);

    testSample.forEach(r => {
      const val = r[colMap.INTERACTION_HISTORY];
      if (toDate(val) || latestDateFromText(val)) currentDatesFound++;
    });

    if (currentDatesFound > 0) {
      return colMap.INTERACTION_HISTORY; // Currently mapped column works!
    }

    // Current column produced 0 dates. Scan other candidate columns.
    const maxCols = Math.max(...dataRows.slice(0, 5).map(r => r.length));
    const excludedIndices = new Set([
      colMap.AE_PRIMARY, colMap.OPP_NAME, colMap.STAGE,
      colMap.ARR, colMap.CLOSE_DATE, colMap.STAGE_DURATION, colMap.AGE,
      colMap.NEXT_STEP_DATE, colMap.NEXT_STEP_DESC,
    ]);

    let bestColIdx = colMap.INTERACTION_HISTORY;
    let maxDatesInCol = 0;

    for (let c = 0; c < maxCols; c++) {
      if (excludedIndices.has(c)) continue;
      let dateCount = 0;
      testSample.forEach(r => {
        const val = r[c];
        if (toDate(val) || latestDateFromText(val)) dateCount++;
      });
      if (dateCount > maxDatesInCol) {
        maxDatesInCol = dateCount;
        bestColIdx = c;
      }
    }

    if (maxDatesInCol > 0) {
      console.warn(`[Auto-Discovery] Re-mapped INTERACTION_HISTORY from col ${colMap.INTERACTION_HISTORY} to col ${bestColIdx} (${maxDatesInCol} dates found)`);
      return bestColIdx;
    }

    return colMap.INTERACTION_HISTORY;
  }

  // ----------------------------------------------------------
  //  Row → Deal object
  // ----------------------------------------------------------
  function rowToDeal(row, cols) {
    const C = cols || CONFIG.COLS;

    const interactionRaw = String(row[C.INTERACTION_HISTORY] || '').trim();

    // Interaction History: try direct date parse first, then extract latest date from text
    let lastInteraction = toDate(row[C.INTERACTION_HISTORY]);
    if (!lastInteraction) lastInteraction = latestDateFromText(interactionRaw);

    return {
      aePrimary:           String(row[C.AE_PRIMARY]    || '').trim(),
      oppName:             String(row[C.OPP_NAME]       || '').trim(),
      accountName:         String(row[C.ACCOUNT_NAME]   || '').trim(),
      stage:               String(row[C.STAGE]          || '').trim(),
      arr:                 toNumber(row[C.ARR]),
      closeDate:           toDate(row[C.CLOSE_DATE]),
      interactionHistory:  interactionRaw,
      lastInteractionDate: lastInteraction,
      nextStepDate:        toDate(row[C.NEXT_STEP_DATE]),
      nextStepDesc:        String(row[C.NEXT_STEP_DESC] || '').trim(),
      stageDuration:       toNumber(row[C.STAGE_DURATION]),
      age:                 toNumber(row[C.AGE]),
    };
  }

  // ----------------------------------------------------------
  //  Main entry — parse an xlsx / xls / csv File object
  // ----------------------------------------------------------
  function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);

          // cellDates:true enables SheetJS Date parsing for formatted date cells
          const wb = XLSX.read(data, { type: 'array', cellDates: true });

          const ws   = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: '',
            raw:    true,
          });

          if (rows.length < 2) {
            return reject(new Error(
              'The uploaded file appears to be empty or has no data rows.'
            ));
          }

          // 1. Detect header row
          const headerRowIdx = detectHeaderRow(rows);
          const headers      = rows[headerRowIdx];

          // 2. Map columns using scoring rules
          const colMap       = mapColumns(headers);

          // 3. Extract data rows
          const dataRows = rows.slice(headerRowIdx + 1).filter(r => r[colMap.AE_PRIMARY]);

          // 4. Data-level column auto-discovery if needed
          colMap.INTERACTION_HISTORY = autoDiscoverInteractionColumn(dataRows, colMap);

          // 5. Convert rows to deal objects
          const deals = dataRows.map(r => rowToDeal(r, colMap))
                                 .filter(d => d.aePrimary && d.oppName);

          if (!deals.length) {
            return reject(new Error(
              'No deal rows found. Check that AE-Primary and Opportunity Name columns are populated.'
            ));
          }

          // Debug log in browser console
          const trackedInteractions = deals.filter(d => d.lastInteractionDate).length;
          console.group('📊 Parser — Upload Details (v4)');
          console.log(`Detected header row index: ${headerRowIdx}`);
          console.log('Resolved column mapping:', colMap);
          console.log(`Total deals loaded: ${deals.length}`);
          console.log(`Deals with tracked interaction dates: ${trackedInteractions} / ${deals.length}`);
          if (deals.length > 0) {
            console.table(deals.slice(0, 5).map(d => ({
              AE:              d.aePrimary,
              Opp:             d.oppName,
              Stage:           d.stage,
              ARR:             d.arr,
              CloseDate:       d.closeDate ? d.closeDate.toLocaleDateString() : 'null',
              RawInteraction:  d.interactionHistory,
              LastInteraction: d.lastInteractionDate ? d.lastInteractionDate.toLocaleDateString() : 'null',
              NextStepDate:    d.nextStepDate ? d.nextStepDate.toLocaleDateString() : 'null',
            })));
          }
          console.groupEnd();

          resolve({ deals, headers, uploadDate: new Date(), fileName: file.name });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ----------------------------------------------------------
  //  Helpers used by other modules
  // ----------------------------------------------------------
  function getUniqueAEs(deals) {
    return [...new Set(deals.map(d => d.aePrimary))].sort();
  }

  function dealsForAE(deals, ae) {
    return deals.filter(d => d.aePrimary === ae);
  }

  function getCurrentQuarter() {
    const now   = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();
    const q     = Math.floor(month / 3);
    const start = new Date(year, q * 3, 1, 0, 0, 0, 0);
    const end   = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
    return { q: q + 1, year, start, end };
  }

  return {
    parseExcelFile,
    getUniqueAEs,
    dealsForAE,
    getCurrentQuarter,
    latestDateFromText,
    extractDatesFromText,
    toDate,
    mapColumns,
    detectHeaderRow,
    autoDiscoverInteractionColumn,
  };
})();
