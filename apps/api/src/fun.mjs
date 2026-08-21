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
  const deg = `${t}\u00b0`;
  const lines = {
    clear: isDay
      ? [
          `${deg} and not a cloud to hide your sins.`,
          `Sun's out. ${deg}. Shirt optional. Ambition already quit.`,
          t >= 90
            ? `It's ${deg}. The asphalt wants a fight. Sit down.`
            : `Clear, ${deg}. Go outside or admit you're a cave troll.`,
          `Blue sky, ${deg}. Disgustingly nice. Don't waste it on laundry.`
        ]
      : [
          `Moon's out, ${deg}. Perfect night to be a problem.`,
          `Clear night, ${deg}. Nobody's watching. That's a warning.`,
          t <= 32 ? `Pretty and ${deg}. Cold enough to ruin a mood.` : `Night's clear. ${deg}. Don't do anything you'd explain tomorrow.`
        ],
    fair: [
      `${deg}. Sun's half-assing it. Same as you.`,
      isDay ? `A few clouds, ${deg}. Sky's indecisive. Iconic.` : `Moon with a hoodie. ${deg}. Soft lighting for bad ideas.`
    ],
    overcast: [
      `Gray lid on. ${deg}. The sky cancelled and didn't text.`,
      `Overcast. ${deg}. Sweatpants weather. No notes.`
    ],
    fog: [
      `Fog. ${deg}. Drive like you've got a body in the trunk.`,
      `Can't see squat. ${deg}. The air is being extra.`
    ],
    drizzle: [
      `Sky's leaking. ${deg}. Annoying, not impressive.`,
      `Drizzle. ${deg}. Wet enough to ruin the hair, not the plans.`
    ],
    rain: [
      `Rain. ${deg}. Stay in. Be unproductive on purpose.`,
      w >= 20 ? `Rain and ${w} mph. The sky is being a jerk. Tap out.` : `Soaked. ${deg}. Your shoes already lost.`
    ],
    snow: [
      `Snow. ${deg}. Cute for six minutes. Then it's a chore.`,
      `White stuff. ${deg}. If you have to go out, you already lost.`
    ],
    storm: [
      `Thunder. ${deg}. Unplug the tower and enjoy the tantrum.`,
      w >= 25 ? `Storm + ${w} mph. Don't be the afterthought.` : `Lightning. ${deg}. Stay off the porch, genius.`
    ],
    fallback: [`Sky's being weird. ${deg}. Don't trust it.`] 
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

export async function funPayload(req, reply) {
  reply?.header?.("cache-control", "no-store");
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
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=5&timezone=auto`
  )
    .then((r) => r.json())
    .catch(() => null);

  const cur = weather?.current ?? {};
  const isDay = Number(q.isDay ?? cur.is_day ?? 1) === 1;
  const days =
    weather?.daily?.time?.map((day, i) => ({
      day,
      hi: weather.daily.temperature_2m_max[i],
      lo: weather.daily.temperature_2m_min[i],
      icon: iconFor(weather.daily.weather_code[i], true)
    })) ?? [];

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
