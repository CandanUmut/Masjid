// Private prayer check-off. Stored only on this device, pruned after 120 days. No streaks, no guilt.
const KEY = "masjid.prayed.v1";
const KEEP_DAYS = 120;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function write(data) {
  const keys = Object.keys(data).sort();
  while (keys.length > KEEP_DAYS) delete data[keys.shift()];
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: tracking simply won't persist */
  }
}

export function prayedOn(dayKey) {
  return new Set(read()[dayKey] || []);
}

export function isPrayed(dayKey, prayer) {
  return prayedOn(dayKey).has(prayer);
}

export function setPrayed(dayKey, prayer, on) {
  const data = read();
  const set = new Set(data[dayKey] || []);
  if (on) set.add(prayer);
  else set.delete(prayer);
  if (set.size) data[dayKey] = [...set];
  else delete data[dayKey];
  write(data);
}
