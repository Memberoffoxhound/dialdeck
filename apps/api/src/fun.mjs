const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function iconFor(code, isDay) {
  if (code == null) return "❓";
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2) return isDay ? "🌤️" : "🌑";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code === 85 || code === 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "☁️";
}

function roast({ code, temp, wind, isDay }) {
  const t = Math.round(Number(temp) || 0);
  const w = Math.round(Number(wind) || 0);
  const heat = t >= 92;
  const cold = t <= 28;
  const lines = {
    clear: [
      isDay
        ? `Sun's out, ${t}\u00b0. No excuse. Go touch grass or admit you're a goblin.`
        : `Clear night, ${t}\u00b0. Moon's clocking in. You're still indoors. Respect.`,
      heat
        ? `${t}\u00b0 and not a cloud to hide under. The sun is being a menace.`
        : cold
          ? `Pretty sky, mean air. ${t}\u00b0. Jacket or regret.`
          : `${t}\u00b0 and clear. Weather did its job. Don't make it a personality.`
    ],
    fair: [
      `${t}\u00b0, a few clouds loitering. Sky's half-assing it.`,
      isDay ? `Sun peeking through like it owes rent. ${t}\u00b0.` : `Cloudy moon energy. ${t}\u00b0. Cozy or depressing. Your call.`
    ],
    overcast: [
      `Ceiling's down. ${t}\u00b0 of leftover dishwater sky.`,
      `Gray on gray. ${t}\u00b0. Midwest default skin.`
    ],
    fog: [
      `Fog. ${t}\u00b0. Drive like you've got something to lose.`,
      `Can't see squat. ${t}\u00b0. The air is thick on purpose.`
    ],
    drizzle: [
      `Drizzle. ${t}\u00b0. Not rain enough to count, wet enough to ruin the vibe.`,
      `Sky's leaking. ${t}\u00b0. Annoyed, not endangered.`
    ],
    rain: [
      `Rain. ${t}\u00b0. Your shoes are about to have a bad night.`,
      w >= 20 ? `Rain plus ${w} mph wind. Stay in and start a raid.` : `It's dumping. ${t}\u00b0. Don't be a hero.`
    ],
    snow: [
      `Snow. ${t}\u00b0. Cute for five minutes. Then it's a chore.`,
      `White stuff. ${t}\u00b0. If you have to go out, you already lost.`
    ],
    storm: [
      `Thunder. ${t}\u00b0. Unplug the fancy gear and enjoy the light show.`,
      w >= 25 ? `Storm and ${w} mph. The sky is picking a fight.` : `It's being ugly out. Close the blinds and game.`
    ],
    fallback: [`Sky's being weird. ${t}\u00b0. Don't trust it.`] 
  };
  if (code == null) return pick(lines.fallback);
  if (code === 0) return pick(lines.clear);
  if (code <= 2) return pick(lines.fair);
  if (code === 3) return pick(lines.overcast);
  if (code === 45 || code === 48) return pick(lines.fog);
  if (code >= 51 && code <= 57) return pick(lines.drizzle);
  if (code >= 61 && code <= 67) return pick(lines.rain);
  if (code >= 71 && code <= 77) return pick(lines.snow);
  if (code >= 80 && code <= 82) return pick(lines.rain);
  if (code === 85 || code === 86) return pick(lines.snow);
  if (code >= 95) return pick(lines.storm);
  return pick(lines.fallback);
}

function isPrivateIp(ip) {
  if (!ip) return true;
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|localhost)/.test(ip);
}

export function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] ?? "");
  const first = xf.split(",")[0].trim();
  return first || req.ip || "";
}

async function geoFromIp(ip) {
  if (!ip || isPrivateIp(ip)) return null;
  const data = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    headers: { "user-agent": "dialdeck/0.1" }
  })
    .then((r) => r.json())
    .catch(() => null);
  if (!data?.success || !data.latitude) return null;
  const place = [data.city, data.region_code || data.region, data.country_code].filter(Boolean).join(", ");
  return { lat: data.latitude, lon: data.longitude, place };
}

async function loadNews() {
  try {
    const rss = await fetch("https://www.gamespot.com/feeds/news/", {
      headers: { "user-agent": "dialdeck/0.1" }
    }).then((r) => r.text());
    const items = [...rss.matchAll(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>/g)].slice(0, 6);
    let news = items.map((m) => ({ title: m[1], url: m[2] }));
    if (!news.length) {
      const loose = [...rss.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g)].slice(0, 6);
      news = loose.map((m) => ({ title: m[1].replace(/<!\[CDATA\[|\]\]>/g, ""), url: m[2] }));
    }
    return news;
  } catch {
    return [{ title: "Party line is live", url: "#" }];
  }
}

export async function funPayload(req) {
  const q = req.query ?? {};
  let lat = Number(q.lat);
  let lon = Number(q.lon);
  let place = String(q.city ?? "").trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const geo = await geoFromIp(clientIp(req));
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
      place = geo.place;
    } else {
      lat = 38.85;
      lon = -90.01;
      place = place || "Roxana, IL";
    }
  }

  const weather = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,is_day` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,sunrise,sunset` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=16&timezone=auto`
  )
    .then((r) => r.json())
    .catch(() => null);

  const cur = weather?.current ?? {};
  const isDay = Number(q.isDay ?? cur.is_day ?? 1) === 1;
  const days =
    weather?.daily?.time?.map((day, i) => {
      const code = weather.daily.weather_code[i];
      const hi = weather.daily.temperature_2m_max[i];
      const lo = weather.daily.temperature_2m_min[i];
      const wind = weather.daily.wind_speed_10m_max[i];
      return {
        day,
        hi,
        lo,
        icon: iconFor(code, true),
        take: roast({ code, temp: hi, wind, isDay: true })
      };
    }) ?? [];

  return {
    place: place || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    temp: cur.temperature_2m ?? null,
    wind: cur.wind_speed_10m ?? null,
    icon: iconFor(cur.weather_code, isDay),
    sky: roast({ code: cur.weather_code, temp: cur.temperature_2m, wind: cur.wind_speed_10m, isDay }),
    days,
    news: await loadNews()
  };
}
