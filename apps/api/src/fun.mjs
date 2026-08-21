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
          `${deg} and naked sun. Shirt's optional. Dignity already left.`,
          `Sun's out, dicks out energy. ${deg}. Hydrate or get cooked like a rotisserie slut.`,
          t >= 92
            ? `It's ${deg}. The pavement wants to fuck you. Stay inside and be horny in AC.`
            : `Clear, ${deg}. Sky's showing off. You could go outside and still choose the couch. Iconic.`
        ]
      : [
          `Moon's out, ${deg}. Prime weather to be a problem in the dark.`,
          `Clear night, ${deg}. Good for stargazing or other horizontal hobbies.`,
          t <= 32
            ? `Pretty as hell and ${deg}. Cold enough to make nipples a personality.`
            : `Night's clear. ${deg}. Nobody's watching. Don't waste it.`
        ],
    fair: [
      `${deg}, sun teasing through clouds like a cheap stripper. Commit or get off the stage.`,
      isDay
        ? `Half-cloud, ${deg}. Sky's edging you. Nobody finishes.`
        : `Moon with a little cover. ${deg}. Soft lighting for bad decisions.`
    ],
    overcast: [
      `Gray ceiling, ${deg}. The sky put on sweatpants and cancelled. Same.`,
      `Overcast. ${deg}. Mood is unwashed sheets and leftover pizza.`
    ],
    fog: [
      `Fog so thick you could fuck in the street and get away with it. ${deg}.`,
      `Can't see shit. ${deg}. Drive like your secrets are in the trunk.`
    ],
    drizzle: [
      `Sky's pissing on you, just a little. ${deg}. Humiliating, not fatal.`,
      `Drizzle. ${deg}. Wet enough to ruin the hair, not enough to skip the booty call.`
    ],
    rain: [
      `It's dumping. ${deg}. Stay in, get wet on purpose.`,
      w >= 20
        ? `Rain and ${w} mph. The sky is topping you. Tap out.`
        : `Soaked. ${deg}. Perfect weather to cancel plans and be filthy at home.`
    ],
    snow: [
      `Snow. ${deg}. Cute until it's in your crack and your will to live.`,
      `White-out. ${deg}. If you're going out, you're either horny or stupid. Often both.`
    ],
    storm: [
      `Thunder. ${deg}. The sky's moaning. Unplug the tower and join it.`,
      w >= 25
        ? `Storm + ${w} mph. Nature's angry fuck. Don't be the afterthought.`
        : `Lightning. ${deg}. If that's not a vibe, your blood's too clean.`
    ],
    fallback: [`Sky's being a freak. ${deg}. Match the energy.`] 
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
