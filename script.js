const apiKey = 'f822fe46aea7d7f62842fb124e64db9b';

let currentUnit = 'metric';
let lastCity = '';
let lastCoords = null;
let map;
let selectedLatLng = null;
let mapMarker = null;
let currentLocationMarker = null;
let recentCities = JSON.parse(localStorage.getItem('recentCities') || '[]');
let favoriteCities = JSON.parse(localStorage.getItem('favoriteCities') || '[]');
let suggestions = [];
let selectedSuggestionIndex = -1;
let hourlyTempChart, weeklyTempChart, windChart;

const cityInput = document.getElementById('cityInput');
const autocompleteResults = document.getElementById('autocompleteResults');
const forecastContainer = document.getElementById('forecastContainer');
const currentWeatherDiv = document.getElementById('currentWeather');
const airQualityContainer = document.getElementById('airQualityContainer');
const loadingDiv = document.getElementById('loading');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const recentSearchesDiv = document.getElementById('recentSearches');
const humidityGauge = document.getElementById('humidityGauge');
const humidityValue = document.getElementById('humidityValue');
const mobileNavButtons = document.querySelectorAll('.mobile-nav button');
const favoritesDiv = document.getElementById('favoriteCities');
const multiLocationDiv = document.getElementById('multiLocationCards');
const toast = document.getElementById('toast');
const insightDiv = document.getElementById('aiInsight');

const aqiLabels = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
const aqiColors = { 1: '#16a34a', 2: '#65a30d', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };
const formatTime = (unix, tz) => new Date((unix + tz) * 1000).toUTCString().slice(17, 22);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setLoadingSkeleton(active = true) {
  loadingDiv.style.display = active ? 'block' : 'none';
  if (active) currentWeatherDiv.innerHTML = '<div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
}

function renderRecentSearches() {
  recentSearchesDiv.innerHTML = recentCities.length ? '<strong>Recent:</strong> ' : '<span class="muted">No recent cities yet.</span>';
  recentCities.forEach((city) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = city;
    chip.onclick = () => { cityInput.value = city; fetchWeather(city); };
    recentSearchesDiv.appendChild(chip);
  });
}

function renderFavorites() {
  favoritesDiv.innerHTML = favoriteCities.length ? '' : '<span class="muted">No favorites yet.</span>';
  favoriteCities.forEach((city) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `⭐ ${city}`;
    chip.onclick = () => { cityInput.value = city; fetchWeather(city); };
    favoritesDiv.appendChild(chip);
  });
}

async function renderMultiLocation() {
  multiLocationDiv.innerHTML = '';
  for (const city of favoriteCities.slice(0, 4)) {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${currentUnit}&appid=${apiKey}`);
      if (!res.ok) continue;
      const d = await res.json();
      const card = document.createElement('div');
      card.className = 'mini-card';
      card.innerHTML = `<strong>${d.name}</strong><p>${Math.round(d.main.temp)}° • ${d.weather[0].main}</p>`;
      multiLocationDiv.appendChild(card);
    } catch {}
  }
}

function saveRecentCity(city) {
  if (!city) return;
  recentCities = [city, ...recentCities.filter((c) => c.toLowerCase() !== city.toLowerCase())].slice(0, 6);
  localStorage.setItem('recentCities', JSON.stringify(recentCities));
  renderRecentSearches();
}

function toggleFavorite(city) {
  if (!city) return;
  const exists = favoriteCities.some((c) => c.toLowerCase() === city.toLowerCase());
  favoriteCities = exists ? favoriteCities.filter((c) => c.toLowerCase() !== city.toLowerCase()) : [city, ...favoriteCities].slice(0, 10);
  localStorage.setItem('favoriteCities', JSON.stringify(favoriteCities));
  renderFavorites();
  renderMultiLocation();
  showToast(exists ? `${city} removed from favorites` : `${city} added to favorites`);
}

function applyWeatherTheme(data) {
  document.body.classList.remove('weather-sunny', 'weather-rain', 'weather-night');
  const conditionId = data.weather[0].id;
  const icon = data.weather[0].icon;
  if (icon.endsWith('n')) return document.body.classList.add('weather-night');
  if (conditionId >= 200 && conditionId < 700) return document.body.classList.add('weather-rain');
  document.body.classList.add('weather-sunny');
}

function renderHumidityGauge(humidity) { humidityGauge.style.setProperty('--value', humidity); humidityValue.textContent = `${humidity}%`; }

function renderChart(canvasId, chartRef, type, labels, data, color) {
  if (chartRef) chartRef.destroy();
  return new Chart(document.getElementById(canvasId), { type, data: { labels, datasets: [{ data, borderColor: color, backgroundColor: `${color}33`, fill: type !== 'bar', tension: 0.35 }] }, options: { plugins: { legend: { display: false } } } });
}

function renderWeatherCharts(currentData, forecastData) {
  if (!forecastData?.list?.length) return;
  const hourly = forecastData.list.slice(0, 8);
  const labels = hourly.map((d) => d.dt_txt.slice(11, 16));
  hourlyTempChart = renderChart('hourlyTempChart', hourlyTempChart, 'line', labels, hourly.map((d) => Math.round(d.main.temp)), '#3b82f6');
  windChart = renderChart('windChart', windChart, 'line', labels, hourly.map((d) => Math.round(d.wind.speed)), '#22c55e');
  const byDay = {};
  forecastData.list.forEach((i) => ((byDay[i.dt_txt.slice(5, 10)] ||= []).push(i.main.temp)));
  const days = Object.keys(byDay).slice(0, 7);
  weeklyTempChart = renderChart('weeklyTempChart', weeklyTempChart, 'bar', days, days.map((d) => Math.round(byDay[d].reduce((a, b) => a + b, 0) / byDay[d].length)), '#f59e0b');
  renderHumidityGauge(currentData.main.humidity);
}

function buildInsight(data) {
  const t = Math.round(data.main.temp);
  const desc = data.weather[0].main.toLowerCase();
  if (desc.includes('rain')) return 'Rain is likely soon. Carry an umbrella ☔';
  if (t >= 35) return 'Extreme heat detected. Stay hydrated and avoid direct sun 🥵';
  if (t <= 5) return 'Very cold conditions. Dress warmly 🧥';
  return `Comfortable weather with ${desc}. Great time for light outdoor plans 🌤️`;
}

function showWeatherAlerts(data) {
  if (data.weather[0].main.toLowerCase().includes('rain')) showToast('🔔 Rain alert: precipitation expected.');
  if (data.main.temp >= 35 || data.main.temp <= 5) showToast('🔔 Extreme temperature alert.');
}

async function fetchAirQuality(lat, lon) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`); if (!res.ok) throw new Error();
    const data = await res.json(); const aqi = data.list[0].main.aqi;
    airQualityContainer.innerHTML = `<h3>Air Quality</h3><p style="color:${aqiColors[aqi]}">AQI: <strong>${aqi}</strong> (${aqiLabels[aqi]})</p>`;
  } catch { airQualityContainer.innerHTML = '<p class="muted">AQI unavailable right now.</p>'; }
}

function displayCurrentWeather(data) {
  const { name, main, weather, wind, sys, timezone } = data;
  const dayLength = Math.max(1, sys.sunset - sys.sunrise);
  applyWeatherTheme(data);
  const isFavorite = favoriteCities.some((c) => c.toLowerCase() === name.toLowerCase());
  currentWeatherDiv.innerHTML = `<h2 style="margin-top:0">${name} <button id="favBtn" style="margin-left:8px">${isFavorite ? '★' : '☆'}</button></h2>
    <p><strong>${Math.round(main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}</strong> • ${weather[0].description}</p>
    <p>Humidity: ${main.humidity}% • Wind: ${Math.round(wind.speed)} ${currentUnit === 'metric' ? 'm/s' : 'mph'}</p>
    <p>Sunrise: ${formatTime(sys.sunrise, timezone)} • Sunset: ${formatTime(sys.sunset, timezone)}</p>
    <div class="day-progress"><span style="width:${Math.min(100, ((Date.now()/1000 - sys.sunrise) / dayLength) * 100)}%"></span></div>`;
  document.getElementById('favBtn').onclick = () => toggleFavorite(name);
  insightDiv.textContent = buildInsight(data);
  showWeatherAlerts(data);
}

async function fetchWeatherByCoords(lat, lon) {
  setLoadingSkeleton(true);
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${apiKey}`);
    if (!res.ok) throw new Error('Unable to fetch weather data for this location.');
    const data = await res.json();
    displayCurrentWeather(data); lastCity = data.name; lastCoords = { lat, lon }; saveRecentCity(data.name);
    await fetchAirQuality(lat, lon);
    const fr = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${apiKey}`); if (fr.ok) renderWeatherCharts(data, await fr.json());
  } catch (err) {
    currentWeatherDiv.innerHTML = `<p class="error-msg">${navigator.onLine ? err.message : 'No internet connection. Check your network and retry.'}</p>`;
  } finally { setLoadingSkeleton(false); }
}

async function fetchWeather(city) { lastCity = city; return fetchWeatherByCoordsFromCity(city); }
async function fetchWeatherByCoordsFromCity(city){
  setLoadingSkeleton(true);
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${currentUnit}&appid=${apiKey}`);
    if (!res.ok) throw new Error('City not found. Try another city name.');
    const data = await res.json(); lastCoords = { lat: data.coord.lat, lon: data.coord.lon };
    displayCurrentWeather(data); saveRecentCity(data.name); await fetchAirQuality(lastCoords.lat, lastCoords.lon);
    const fr = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lastCoords.lat}&lon=${lastCoords.lon}&units=${currentUnit}&appid=${apiKey}`); if (fr.ok) renderWeatherCharts(data, await fr.json());
  } catch (err) {
    currentWeatherDiv.innerHTML = `<p class="error-msg">${navigator.onLine ? err.message : 'No internet connection. Check your network and retry.'}</p>`;
  } finally { setLoadingSkeleton(false); }
}

let debounceTimeout = null;
function renderSuggestions() {
  autocompleteResults.innerHTML = '';
  suggestions.forEach((loc, idx) => {
    const div = document.createElement('div');
    div.className = `result-row ${idx === selectedSuggestionIndex ? 'active' : ''}`;
    div.textContent = `${loc.name}${loc.state ? ', ' + loc.state : ''}, ${loc.country}`;
    div.onclick = () => { cityInput.value = loc.name; autocompleteResults.innerHTML = ''; fetchWeather(loc.name); };
    autocompleteResults.appendChild(div);
  });
}

cityInput.addEventListener('input', () => {
  const query = cityInput.value.trim(); clearTimeout(debounceTimeout); if (query.length < 3) return (autocompleteResults.innerHTML = '');
  debounceTimeout = setTimeout(async () => {
    const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=6&appid=${apiKey}`);
    suggestions = await res.json(); selectedSuggestionIndex = -1; renderSuggestions();
  }, 180);
});

cityInput.addEventListener('keydown', (e) => {
  if (!suggestions.length && e.key === 'Enter') return fetchWeather(cityInput.value.trim());
  if (e.key === 'ArrowDown') { e.preventDefault(); selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1); renderSuggestions(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, 0); renderSuggestions(); }
  if (e.key === 'Enter') { e.preventDefault(); const pick = suggestions[selectedSuggestionIndex] || { name: cityInput.value.trim() }; cityInput.value = pick.name; autocompleteResults.innerHTML = ''; fetchWeather(pick.name); }
});

document.getElementById('voiceBtn').onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return showToast('Voice search not supported in this browser.');
  const rec = new SR(); rec.lang = 'en-US'; rec.onresult = (e) => { cityInput.value = e.results[0][0].transcript.replace(/weather in\s*/i, ''); fetchWeather(cityInput.value); }; rec.start();
};

document.querySelectorAll('input[name="unit"]').forEach((r) => r.addEventListener('change', () => { currentUnit = document.querySelector('input[name="unit"]:checked').value; if (lastCoords) fetchWeatherByCoords(lastCoords.lat, lastCoords.lon); else if (lastCity) fetchWeather(lastCity); renderMultiLocation(); }));
document.getElementById('clearRecentBtn').onclick = () => { recentCities = []; localStorage.removeItem('recentCities'); renderRecentSearches(); };
document.getElementById('getWeatherBtn').onclick = () => cityInput.value.trim() && fetchWeather(cityInput.value.trim());
document.getElementById('locateBtn').onclick = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => { selectedLatLng = { lat: p.coords.latitude, lng: p.coords.longitude }; fetchWeatherByCoords(selectedLatLng.lat, selectedLatLng.lng); showToast('Location detected successfully.'); }, () => showToast('Could not access your location.')) : showToast('Geolocation unsupported.');
document.getElementById('forecastBtn').onclick = () => showToast('Forecast auto-updates in charts and weather cards.');
document.getElementById('mapSelectBtn').onclick = () => { document.getElementById('mapContainer').style.display = 'block'; initMap(); };
document.getElementById('confirmMapSelection').onclick = () => selectedLatLng ? fetchWeatherByCoords(selectedLatLng.lat, selectedLatLng.lng) : showToast('Tap on the map to choose a location.');

function setupMobileNav(){mobileNavButtons.forEach((btn)=>btn.onclick=()=>{const id=btn.dataset.target,target=document.getElementById(id);if(!target)return;target.scrollIntoView({behavior:'smooth'});mobileNavButtons.forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(id==='mapContainer'){document.getElementById('mapContainer').style.display='block';initMap();}})}

function initMap() {
  if (!map) {
    map = L.map('map').setView([20, 0], 2);
    const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    const cloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`, { opacity: 0.5 }).addTo(map);
    const rainLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`, { opacity: 0.55 }).addTo(map);
    L.control.layers({ OpenStreetMap: baseLayer }, { Clouds: cloudsLayer, Rain: rainLayer }, { collapsed: false }).addTo(map);
    map.on('click', (e) => { selectedLatLng = e.latlng; if (mapMarker) map.removeLayer(mapMarker); mapMarker = L.marker(e.latlng).addTo(map); fetchWeatherByCoords(selectedLatLng.lat, selectedLatLng.lng); });
  }
  setTimeout(() => map.invalidateSize(), 80);
}

function detectDeviceTheme(){const stored=localStorage.getItem('themeMode'),hour=new Date().getHours(),autoDark=hour>=19||hour<6,prefers=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;const useDark=stored?stored==='dark':(prefers||autoDark);document.body.classList.toggle('dark-theme',useDark);themeToggleBtn.textContent=useDark?'Switch to Light Mode':'Switch to Dark Mode';}

detectDeviceTheme();
renderRecentSearches();
renderFavorites();
renderMultiLocation();
setupMobileNav();
themeToggleBtn.onclick=()=>{const dark=!document.body.classList.contains('dark-theme');document.body.classList.toggle('dark-theme',dark);themeToggleBtn.textContent=dark?'Switch to Light Mode':'Switch to Dark Mode';localStorage.setItem('themeMode',dark?'dark':'light')};
window.addEventListener('offline',()=>showToast('You are offline. Some weather data may be unavailable.'));
