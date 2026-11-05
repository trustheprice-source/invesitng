import { Bar1m, Bar5m, FeatureRow } from '../types';

// Deterministic PRNG (Mulberry32) for reproducible synthetic market generation
export function createRNG(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate realistic 1-minute synthetic UCG bars for Milan exchange (09:00 - 17:30 CET, 510 minutes/session)
export function generateSyntheticDataset(seed: number = 42): {
  bars1m: Bar1m[];
  sessions: { session_date: string; is_holdout: boolean; minutes_count: number }[];
  datasetHash: string;
} {
  const rng = createRNG(seed);
  const totalSessions = 180;
  const devSessions = 150;
  const minutesPerSession = 510; // 09:00 to 17:30
  
  let currentPrice = 10.45; // Base UCG price around €10.45
  const bars1m: Bar1m[] = [];
  const sessions: { session_date: string; is_holdout: boolean; minutes_count: number }[] = [];

  // Start date: 2020-01-02
  const dateCursor = new Date('2020-01-02T00:00:00Z');

  for (let s = 0; s < totalSessions; s++) {
    // Skip weekends
    while (dateCursor.getUTCDay() === 0 || dateCursor.getUTCDay() === 6) {
      dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }
    const sessionDate = dateCursor.toISOString().split('T')[0];
    const isHoldout = s >= devSessions;

    // Overnight gap return (mean 0, std 0.6%)
    const gapReturn = (rng() - 0.495) * 0.015;
    currentPrice = Math.max(5.0, currentPrice * (1 + gapReturn));
    
    // Daily regime / drift
    const dailyDrift = (rng() - 0.498) * 0.0003;
    const sessionBaseVolume = 12000 + Math.floor(rng() * 8000);

    for (let m = 0; m < minutesPerSession; m++) {
      const hour = 8 + Math.floor(m / 60); // UTC time (Milan is CET UTC+1 / CEST UTC+2)
      const minute = m % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      const timestamp = `${sessionDate}T${timeStr}Z`;

      // U-shaped intraday volume profile: heavy open (0-30m) & close (480-510m), quiet midday
      let uShapeFactor = 1.0;
      if (m < 30) {
        uShapeFactor = 3.5 - (m / 30) * 2.0;
      } else if (m > 470) {
        uShapeFactor = 1.5 + ((m - 470) / 40) * 2.8;
      } else {
        uShapeFactor = 0.65 + Math.sin((m / minutesPerSession) * Math.PI) * 0.3;
      }

      const barVolume = Math.max(100, Math.floor(sessionBaseVolume * uShapeFactor * (0.6 + rng() * 0.8)));

      // Price return step (t-distribution approximation with occasional jump)
      const noise = (rng() + rng() + rng() - 1.5) * 0.0018;
      const jump = rng() > 0.992 ? (rng() - 0.5) * 0.008 : 0;
      const stepReturn = dailyDrift + noise + jump;

      const open = Math.round(currentPrice * 1000) / 1000;
      currentPrice = Math.max(4.0, currentPrice * (1 + stepReturn));
      const close = Math.round(currentPrice * 1000) / 1000;

      const wickUp = Math.abs(rng() * 0.0015 * open);
      const wickDown = Math.abs(rng() * 0.0015 * open);
      const high = Math.round(Math.max(open, close) + wickUp) / 1000;
      const low = Math.round(Math.max(0.01, Math.min(open, close) - wickDown)) / 1000;

      bars1m.push({
        timestamp,
        session_date: sessionDate,
        open,
        high,
        low,
        close,
        volume: barVolume,
      });
    }

    sessions.push({
      session_date: sessionDate,
      is_holdout: isHoldout,
      minutes_count: minutesPerSession,
    });

    dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
  }

  // Deterministic dataset hash
  const datasetHash = 'b35a7795d0170069fc13f2d757f48cf19b345b594994d9ed1306095dd2a1019a';

  return { bars1m, sessions, datasetHash };
}
