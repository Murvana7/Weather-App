const $ = (s) => document.querySelector(s);

const API_KEY = "c7855b3da813cbca49d3ebe0c39a5e34"; // your key

const cityInput = $("#cityInput");
const searchBtn = $("#searchBtn");
const geoBtn = $("#geoBtn");
const unitBtn = $("#unitBtn");
const unitText = $("#unitText");

const loadingState = $("#loadingState");
const errorState = $("#errorState");
const errorMsg = $("#errorMsg");
const weatherCard = $("#weatherCard");

const placeEl = $("#place");
const localTimeEl = $("#localTime");
const iconEl = $("#icon");
const tempEl = $("#temp");
const descEl = $("#desc");

const feelsEl = $("#feels");
const tminEl = $("#tmin");
const tmaxEl = $("#tmax");

const humidityEl = $("#humidity");
const windEl = $("#wind");
const pressureEl = $("#pressure");
const visibilityEl = $("#visibility");
const sunriseEl = $("#sunrise");
const sunsetEl = $("#sunset");

const clearBtn = $("#clearBtn");

const KEY_CITY = "boss_weather_city_v1";
const KEY_UNIT = "boss_weather_unit_v1"; // "metric" | "imperial"

let units = localStorage.getItem(KEY_UNIT) || "metric";
setUnitUI();

function setUnitUI(){
  unitText.textContent = units === "metric" ? "°C" : "°F";
}

function showLoading(on){
  loadingState.style.display = on ? "flex" : "none";
}
function showError(msg){
  errorMsg.textContent = msg;
  errorState.style.display = "flex";
  weatherCard.style.display = "none";
  showLoading(false);
}
function showWeather(){
  errorState.style.display = "none";
  weatherCard.style.display = "block";
  showLoading(false);
}

function kphFromMs(ms){
  return Math.round(ms * 3.6);
}
function mphFromMs(ms){
  return Math.round(ms * 2.23694);
}

function toLocalTime(unixSeconds, tzOffsetSeconds){
  const date = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return date.toUTCString().slice(17, 22); // HH:MM
}
function localClock(nowUnix, tzOffsetSeconds){
  const d = new Date((nowUnix + tzOffsetSeconds) * 1000);
  // build like "Tue • 14:05"
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const day = days[d.getUTCDay()];
  const hh = String(d.getUTCHours()).padStart(2,"0");
  const mm = String(d.getUTCMinutes()).padStart(2,"0");
  return `${day} • ${hh}:${mm}`;
}

function iconUrl(icon){
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

async function fetchWeatherByCity(city){
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${units}`;
  return fetchJson(url);
}

async function fetchWeatherByCoords(lat, lon){
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`;
  return fetchJson(url);
}

async function fetchJson(url){
  showLoading(true);
  errorState.style.display = "none";
  weatherCard.style.display = "none";
  searchBtn.disabled = true;

  try{
    const res = await fetch(url);
    const data = await res.json();

    // OpenWeather uses numeric cod sometimes
    if(!res.ok || (data && data.cod && Number(data.cod) !== 200)){
      const code = data?.cod;
      const msg = data?.message || "Request failed.";
      if(Number(code) === 404) throw new Error("City not found. Try a different spelling.");
      throw new Error(msg);
    }
    return data;
  }finally{
    searchBtn.disabled = false;
    showLoading(false);
  }
}

function render(data){
  const name = data.name;
  const country = data.sys?.country ? `, ${data.sys.country}` : "";
  const tz = data.timezone || 0; // seconds
  const now = data.dt || Math.floor(Date.now()/1000);

  placeEl.textContent = `${name}${country}`;
  localTimeEl.textContent = `Local time: ${localClock(now, tz)}`;

  const w = data.weather?.[0];
  const main = data.main;

  iconEl.src = iconUrl(w.icon);
  iconEl.alt = w.description || "weather";

  const unitSymbol = units === "metric" ? "°C" : "°F";

  tempEl.textContent = `${Math.round(main.temp)}${unitSymbol}`;
  descEl.textContent = w.description || "—";

  feelsEl.textContent = `${Math.round(main.feels_like)}${unitSymbol}`;
  tminEl.textContent = `${Math.round(main.temp_min)}${unitSymbol}`;
  tmaxEl.textContent = `${Math.round(main.temp_max)}${unitSymbol}`;

  humidityEl.textContent = `${main.humidity}%`;

  const windSpeed = data.wind?.speed ?? 0;
  windEl.textContent = units === "metric"
    ? `${kphFromMs(windSpeed)} km/h`
    : `${mphFromMs(windSpeed)} mph`;

  pressureEl.textContent = `${main.pressure} hPa`;

  const visM = data.visibility ?? 0;
  visibilityEl.textContent = visM >= 1000 ? `${(visM/1000).toFixed(1)} km` : `${visM} m`;

  const sunrise = data.sys?.sunrise;
  const sunset = data.sys?.sunset;

  sunriseEl.textContent = sunrise ? toLocalTime(sunrise, tz) : "—";
  sunsetEl.textContent  = sunset  ? toLocalTime(sunset, tz)  : "—";

  showWeather();
}

async function runCity(){
  const city = cityInput.value.trim();
  if(!city) return showError("Type a city name first.");
  localStorage.setItem(KEY_CITY, city);

  try{
    const data = await fetchWeatherByCity(city);
    render(data);
  }catch(err){
    showError(err.message || "Failed to load weather.");
  }
}

searchBtn.addEventListener("click", runCity);

cityInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter") runCity();
});

unitBtn.addEventListener("click", async () => {
  units = (units === "metric") ? "imperial" : "metric";
  localStorage.setItem(KEY_UNIT, units);
  setUnitUI();

  // re-fetch using last city if available
  const savedCity = localStorage.getItem(KEY_CITY);
  if(savedCity){
    cityInput.value = savedCity;
    await runCity();
  }
});

geoBtn.addEventListener("click", () => {
  if(!navigator.geolocation) return showError("Geolocation not supported in this browser.");

  showLoading(true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try{
      const { latitude, longitude } = pos.coords;
      const data = await fetchWeatherByCoords(latitude, longitude);
      cityInput.value = data.name || "";
      localStorage.setItem(KEY_CITY, cityInput.value);
      render(data);
    }catch(err){
      showError(err.message || "Failed to load location weather.");
    }
  }, () => {
    showError("Location permission denied. You can still search by city.");
  }, { enableHighAccuracy:true, timeout: 10000 });
});

clearBtn.addEventListener("click", () => {
  cityInput.value = "";
  localStorage.removeItem(KEY_CITY);
  weatherCard.style.display = "none";
  errorState.style.display = "none";
});

(function init(){
  const savedCity = localStorage.getItem(KEY_CITY);
  if(savedCity){
    cityInput.value = savedCity;
    runCity();
  }
})();
