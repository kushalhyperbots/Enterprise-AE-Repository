// ============================================================
//  Sales Dashboard — Configuration
// ============================================================

const CONFIG = {

  // ----------------------------------------------------------
  // Column indices (0-based). Match your Salesforce export.
  //   A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11
  // ----------------------------------------------------------
  COLS: {
    AE_PRIMARY:          0,   // A  — AE-Primary
    OPP_NAME:            1,   // B  — Opportunity Name
    // C not used
    STAGE:               3,   // D  — Stage
    // E not used
    ARR:                 5,   // F  — ARR
    CLOSE_DATE:          6,   // G  — Close Date
    INTERACTION_HISTORY: 7,   // H  — Interaction History
    NEXT_STEP_DATE:      8,   // I  — Next Step Date
    NEXT_STEP_DESC:      9,   // J  — Next Step Description
    STAGE_DURATION:      10,  // K  — Stage Duration (days)
    AGE:                 11,  // L  — Age (days)
  },

  // ----------------------------------------------------------
  // Quota — default $100k/quarter per AE.
  // Add overrides here: { 'Jane Smith': 150000 }
  // ----------------------------------------------------------
  DEFAULT_QUOTA: 100000,
  AE_QUOTAS: {},

  // ----------------------------------------------------------
  // Stage name that counts as Closed Won
  // ----------------------------------------------------------
  CLOSED_WON_STAGE: '8. Closed Won',

  // ----------------------------------------------------------
  // Thresholds
  // ----------------------------------------------------------
  NEW_OPP_AGE_DAYS: 7,         // Age ≤ 7 → New Pipeline
  RECENT_MEETING_DAYS: 7,      // Interaction within 7 days → last week

  // ----------------------------------------------------------
  // Deal Table
  // ----------------------------------------------------------
  TOP_DEALS_LIMIT: 5,

  // ----------------------------------------------------------
  // localStorage / sessionStorage keys
  // ----------------------------------------------------------
  STORAGE_KEYS: {
    CURRENT_DATA:    'sd_current_data',
    CURRENT_DATE:    'sd_current_date',
    PREV_DATA:       'sd_prev_data',
    PREV_DATE:       'sd_prev_date',
    FIREBASE_CONFIG: 'sd_firebase_config',
    DEAL_TABLES:     'sd_deal_tables',
    SELECTED_AE:     'sd_selected_ae',
  },

  // ----------------------------------------------------------
  // Chart colour palette (per stage index)
  // ----------------------------------------------------------
  CHART_COLORS: [
    '#3b82f6', '#7c3aed', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#ec4899', '#84cc16',
    '#f97316', '#6366f1',
  ],
};

// Derive quota for a given AE name
CONFIG.getQuota = (aeName) =>
  CONFIG.AE_QUOTAS[aeName] || CONFIG.DEFAULT_QUOTA;
