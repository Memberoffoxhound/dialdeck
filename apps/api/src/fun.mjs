function roast({ code, temp, wind }) {
  const t = Math.round(temp ?? 0);
  const w = Math.round(wind ?? 0);
  if (code == null) return "Sky's ghosting us. Classic."
  if (code === 0) {
    if (t >= 90) return `It's ${t}\u00b0 and the sun is being a dick. Hydrate or perish.`;
    if (t <= 32) return `Clear and ${t}\u00b0. Pretty sky, mean-ass air.`;
    return `Clear, ${t}\u00b0. Go outside. Touch grass. We both know you won't.`;
  }
  if (code < 4) {
    return `${t}\u00b0 and mostly fine. Don't make it a personality.`;
  }
  if (code < 50) {
    return `Fog/haze at ${t}\u00b0. The Midwest doing its "mysterious" bit.`;
  }
  if (code < 70) {
    return `Rain. ${t}\u00b0. Your shoes are about to have a bad night.`;
  }
  if (code < 80) {
    return `Snow-ish, ${t}\u00b0. Don't be a hero.`;
  }
  if (w >= 25) return `Storm and ${w} mph wind. Stay inside and start a raid.`;
  return `It's being ugly out. ${t}\u00b0. Close the blinds and game.`;
}

export async function funPayload() {
  const weather = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=38.85&longitude=-90.01&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3"
  )
    .then((r) => r.json())
    .catch(() => null);

  let news = [];
  try {
    const rss = await fetch("https://www.gamespot.com/feeds/news/", {
      headers: { "user-agent": "dialdeck/0.1" }
    }).then((r) => r.text());
    const items = [...rss.matchAll(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>/g)].slice(0, 6);
    news = items.map((m) => ({ title: m[1], url: m[2] }));
    if (!news.length) {
      const loose = [...rss.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g)].slice(0, 6);
      news = loose.map((m) => ({ title: m[1].replace(/<!\[CDATA\[|\]\]>/g, ""), url: m[2] }));
    }
  } catch {
    news = [{ title: "Party line is live", url: "#" }];
  }

  const cur = weather?.current ?? {};
  const days = weather?.daily?.time?.map((day, i) => ({
    day,
    hi: weather.daily.temperature_2m_max[i],
    lo: weather.daily.temperature_2m_min[i],
    take: roast({
      code: weather.daily.weather_code[i],
      temp: weather.daily.temperature_2m_max[i],
      wind: cur.wind_speed_10m
    })
  })) ?? [];

  return {
    place: "Roxana, IL",
    temp: cur.temperature_2m ?? null,
    wind: cur.wind_speed_10m ?? null,
    sky: roast({ code: cur.weather_code, temp: cur.temperature_2m, wind: cur.wind_speed_10m }),
    days,
    news
  };
}
