/** Session-only notice when outcomes were restored from a Pilot TRX file (v1.2+). */
export interface RehydrateNotice {
  trxFileName: string;
  mtimeMs: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}
