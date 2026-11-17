/** 界面偏好（每台设备自己的：面板展开 / 收起）。读写失败时用默认值。 */
export function getPref(key: string, dflt: boolean): boolean {
  try { const v = localStorage.getItem(`sanlinbang-ui-${key}`); return v === null ? dflt : v === '1'; } catch { return dflt; }
}
export function setPref(key: string, v: boolean) {
  try { localStorage.setItem(`sanlinbang-ui-${key}`, v ? '1' : '0'); } catch { /* 无痕模式 */ }
}
