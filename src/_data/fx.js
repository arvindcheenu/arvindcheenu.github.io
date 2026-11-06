// Exchange rates for the grant amounts, per 1 EUR, from the European Central Bank
// via frankfurter.dev. Fetched on every build; the page fetches them again live in
// the visitor's browser. If the build has no network, the snapshot below is used.
const SNAPSHOT = {
  date: "2026-11-05",
  rates: { EUR: 1, AUD: 1.6033, CAD: 1.5675, CHF: 0.918, CNY: 7.4846, DKK: 7.4747, GBP: 0.83393, INR: 106.0395, JPY: 177.85, NOK: 10.4365, SEK: 10.9845, USD: 1.1224 },
};

export default async function () {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    if (!j || !j.rates) throw new Error("no rates");
    return { date: j.date, rates: { EUR: 1, ...j.rates }, source: "build" };
  } catch (e) {
    return { ...SNAPSHOT, source: "snapshot" };
  }
}
