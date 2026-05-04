const apiKey = 'f822fe46aea7d7f62842fb124e64db9b';

let currentUnit = 'metric';
let lastCity = '';
let lastCoords = null;
let map;
let selectedLatLng = null;
let mapMarker = null;
let currentLocationMarker = null;
let recentCities = JSON.parse(localStorage.getItem('recentCities') || '[]');

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
let hourlyTempChart, weeklyTempChart, windChart;

const mobileNavButtons = document.querySelectorAll('.mobile-nav button');

function setupMobileNav() {
  mobileNavButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      mobileNavButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (targetId === 'mapContainer') {
        document.getElementById('mapContainer').style.display = 'block';
        initMap();
      }
    });
  });
}



const aqiLabels = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
const formatTime = (unix, tz) => new Date((unix + tz) * 1000).toUTCString().slice(17, 22);

function applyWeatherTheme(data) {
  document.body.classList.remove('weather-sunny', 'weather-rain', 'weather-night');
  const conditionId = data.weather[0].id;
  const icon = data.weather[0].icon;
  const isNight = icon.endsWith('n');

  if (isNight) {
    document.body.classList.add('weather-night');
    return;
  }

  if (conditionId >= 200 && conditionId < 700) {
    document.body.classList.add('weather-rain');
    return;
  }

  document.body.classList.add('weather-sunny');
}


function renderRecentSearches() {
  recentSearchesDiv.innerHTML = recentCities.length ? '<strong>Recent:</strong> ' : '<span class="muted">No recent cities yet.</span>';
  recentCities.forEach((city) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = city;
    chip.onclick = () => {
      cityInput.value = city;
      fetchWeather(city);
    };
    recentSearchesDiv.appendChild(chip);
  });
}

function saveRecentCity(city) {
  if (!city) return;
  recentCities = [city, ...recentCities.filter((c) => c.toLowerCase() !== city.toLowerCase())].slice(0, 6);
  localStorage.setItem('recentCities', JSON.stringify(recentCities));
  renderRecentSearches();
}

function detectDeviceTheme() {
  const stored = localStorage.getItem('themeMode');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = stored ? stored === 'dark' : prefersDark;
  document.body.classList.toggle('dark-theme', useDark);
  themeToggleBtn.textContent = useDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}

function showLoading() { loadingDiv.style.display = 'block'; }
function hideLoading() { loadingDiv.style.display = 'none'; }
function clearForecast() { forecastContainer.innerHTML = ''; }


function renderHumidityGauge(humidity) {
  humidityGauge.style.setProperty('--value', humidity);
  humidityValue.textContent = `${humidity}%`;
}

function renderChart(canvasId, chartRef, type, labels, data, label, color) {
  if (chartRef) chartRef.destroy();
  return new Chart(document.getElementById(canvasId), {
    type,
    data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: `${color}33`, fill: type !== 'bar', tension: 0.35 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
  });
}

function renderWeatherCharts(currentData, forecastData) {
  if (!forecastData?.list?.length) return;
  const hourly = forecastData.list.slice(0, 8);
  const hourlyLabels = hourly.map((d) => d.dt_txt.slice(11, 16));
  const hourlyTemps = hourly.map((d) => Math.round(d.main.temp));
  const windSpeeds = hourly.map((d) => Math.round(d.wind.speed));

  const byDay = {};
  forecastData.list.forEach((item) => {
    const day = item.dt_txt.slice(5, 10);
    (byDay[day] ||= []).push(item.main.temp);
  });
  const weeklyLabels = Object.keys(byDay).slice(0, 7);
  const weeklyTemps = weeklyLabels.map((day) => Math.round(byDay[day].reduce((a, b) => a + b, 0) / byDay[day].length));

  hourlyTempChart = renderChart('hourlyTempChart', hourlyTempChart, 'line', hourlyLabels, hourlyTemps, 'Temp', '#3b82f6');
  weeklyTempChart = renderChart('weeklyTempChart', weeklyTempChart, 'bar', weeklyLabels, weeklyTemps, 'Temp', '#f59e0b');
  windChart = renderChart('windChart', windChart, 'line', hourlyLabels, windSpeeds, 'Wind', '#22c55e');
  renderHumidityGauge(currentData.main.humidity);
}

async function fetchAirQuality(lat, lon) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
    if (!res.ok) throw new Error('AQI unavailable');
    const data = await res.json();
    const aqi = data.list[0].main.aqi;
    airQualityContainer.innerHTML = `<h3>Air Quality</h3><p>AQI: <strong>${aqi}</strong> (${aqiLabels[aqi] || 'Unknown'})</p>`;
  } catch {
    airQualityContainer.innerHTML = '<p class="muted">Air quality data unavailable.</p>';
  }
}

function displayCurrentWeather(data) {
  const { name, main, weather, wind, sys, timezone } = data;
  const iconUrl = `https://openweathermap.org/img/wn/${weather[0].icon}@2x.png`;
  const lastUpdated = new Date().toLocaleString();

  applyWeatherTheme(data);
  currentWeatherDiv.innerHTML = `
    <h2 style="margin-top:0">${name}</h2>
    <img src="${iconUrl}" alt="${weather[0].description}" />
    <p style="font-size:1.1rem;"><strong>${Math.round(main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}</strong> (Feels like ${Math.round(main.feels_like)}°)</p>
    <p>Condition: ${weather[0].description.charAt(0).toUpperCase() + weather[0].description.slice(1)}</p>
    <p>Humidity: ${main.humidity}% • Pressure: ${main.pressure} hPa</p>
    <p>Wind: ${Math.round(wind.speed)} ${currentUnit === 'metric' ? 'm/s' : 'mph'}</p>
    <p>Sunrise: ${formatTime(sys.sunrise, timezone)} • Sunset: ${formatTime(sys.sunset, timezone)}</p>
    <p class="muted">Last updated: ${lastUpdated}</p>`;
}

async function fetchWeather(city) {
  lastCity = city;
  showLoading();
  clearForecast();
  airQualityContainer.innerHTML = '';
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${currentUnit}&appid=${apiKey}`);
    if (!res.ok) throw new Error('City not found');
    const data = await res.json();
    lastCoords = { lat: data.coord.lat, lon: data.coord.lon };
    displayCurrentWeather(data);
    saveRecentCity(data.name);
    await fetchAirQuality(lastCoords.lat, lastCoords.lon);
    const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lastCoords.lat}&lon=${lastCoords.lon}&units=${currentUnit}&appid=${apiKey}`);
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      renderWeatherCharts(data, forecastData);
    }
  } catch (err) {
    currentWeatherDiv.innerHTML = `<p style="color:#ef4444;">${err.message}</p>`;
  } finally {
    hideLoading();
  }
}

async function fetchWeatherByCoords(lat, lon) {
  showLoading();
  clearForecast();
  airQualityContainer.innerHTML = '';
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${apiKey}`);
    if (!res.ok) throw new Error('Unable to fetch weather data');
    const data = await res.json();
    displayCurrentWeather(data);
    lastCity = data.name;
    lastCoords = { lat, lon };
    saveRecentCity(data.name);
    await fetchAirQuality(lat, lon);
    const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${apiKey}`);
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      renderWeatherCharts(data, forecastData);
    }
  } catch (err) {
    currentWeatherDiv.innerHTML = `<p style="color:#ef4444;">${err.message}</p>`;
  } finally {
    hideLoading();
  }
}

async function fetchForecast() {
  if (!lastCity && !lastCoords) return alert('Please search or select a city first.');
  showLoading();
  const endpoint = lastCoords
    ? `https://api.openweathermap.org/data/2.5/forecast?lat=${lastCoords.lat}&lon=${lastCoords.lon}&units=${currentUnit}&appid=${apiKey}`
    : `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(lastCity)}&units=${currentUnit}&appid=${apiKey}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Forecast data not available');
    const data = await res.json();

    forecastContainer.innerHTML = '<h3 style="margin-bottom:0">5-Day Forecast</h3>';
    const byDay = {};
    data.list.forEach((e) => {
      const d = e.dt_txt.split(' ')[0];
      (byDay[d] ||= []).push(e);
    });

    Object.keys(byDay).slice(0, 5).forEach((date) => {
      const entries = byDay[date];
      const avg = Math.round(entries.reduce((s, e) => s + e.main.temp, 0) / entries.length);
      const min = Math.round(Math.min(...entries.map((e) => e.main.temp_min)));
      const max = Math.round(Math.max(...entries.map((e) => e.main.temp_max)));
      forecastContainer.innerHTML += `<div class="day"><h4>${date}</h4><p>${entries[0].weather[0].description}</p><p>Avg: ${avg}° • Low/High: ${min}°/${max}°</p></div>`;
    });
  } catch (err) {
    forecastContainer.innerHTML = `<p style="color:#ef4444;">${err.message}</p>`;
  } finally {
    hideLoading();
  }
}

let debounceTimeout = null;
cityInput.addEventListener('input', () => {
  const query = cityInput.value.trim();
  clearTimeout(debounceTimeout);
  if (query.length < 3) return (autocompleteResults.innerHTML = '');

  debounceTimeout = setTimeout(async () => {
    const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`);
    const data = await res.json();
    autocompleteResults.innerHTML = '';
    data.forEach((loc) => {
      const div = document.createElement('div');
      div.className = 'result-row';
      div.textContent = `${loc.name}${loc.state ? ', ' + loc.state : ''}, ${loc.country}`;
      div.onclick = () => {
        cityInput.value = loc.name;
        autocompleteResults.innerHTML = '';
        fetchWeather(loc.name);
      };
      autocompleteResults.appendChild(div);
    });
  }, 250);
});

document.addEventListener('click', (e) => {
  if (!autocompleteResults.contains(e.target) && e.target !== cityInput) autocompleteResults.innerHTML = '';
});

cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
  }
});

document.querySelectorAll('input[name="unit"]').forEach((r) => {
  r.addEventListener('change', () => {
    currentUnit = document.querySelector('input[name="unit"]:checked').value;
    if (lastCoords) fetchWeatherByCoords(lastCoords.lat, lastCoords.lon);
    else if (lastCity) fetchWeather(lastCity);
  });
});

document.getElementById('clearRecentBtn').addEventListener('click', () => {
  recentCities = [];
  localStorage.removeItem('recentCities');
  renderRecentSearches();
});

document.getElementById('getWeatherBtn').onclick = () => {
  const city = cityInput.value.trim();
  if (city) fetchWeather(city);
};

document.getElementById('locateBtn').onclick = () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition(
    (p) => {
      selectedLatLng = { lat: p.coords.latitude, lng: p.coords.longitude };
      fetchWeatherByCoords(selectedLatLng.lat, selectedLatLng.lng);
      if (map) {
        map.setView([selectedLatLng.lat, selectedLatLng.lng], 8);
        if (currentLocationMarker) map.removeLayer(currentLocationMarker);
        currentLocationMarker = L.circleMarker([selectedLatLng.lat, selectedLatLng.lng], { radius: 8, color: '#22c55e', fillOpacity: 0.9 }).addTo(map).bindPopup('You are here');
      }
    },
    () => alert('Unable to retrieve your location.')
  );
};

document.getElementById('forecastBtn').onclick = fetchForecast;
document.getElementById('mapSelectBtn').onclick = () => {
  document.getElementById('mapContainer').style.display = 'block';
  initMap();
};

document.getElementById('confirmMapSelection').onclick = () => {
  if (!selectedLatLng) return alert('Please select a location on the map.');
  fetchWeatherByCoords(selectedLatLng.lat, selectedLatLng.lng);
  document.getElementById('mapContainer').style.display = 'none';
};

function initMap() {
  if (!map) {
    map = L.map('map').setView([20, 0], 2);

    const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const cloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
      attribution: 'Weather data © OpenWeatherMap',
      opacity: 0.5
    }).addTo(map);

    const rainLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
      attribution: 'Weather data © OpenWeatherMap',
      opacity: 0.55
    }).addTo(map);

    L.control.layers({ 'OpenStreetMap': baseLayer }, { 'Clouds': cloudsLayer, 'Rain': rainLayer }, { collapsed: false }).addTo(map);

    map.on('click', (e) => {
      selectedLatLng = e.latlng;
      if (mapMarker) map.removeLayer(mapMarker);
      mapMarker = L.marker(e.latlng).addTo(map);
      fetchWeatherByCoords(selectedLatLng.lat, selectedLatLng.lng);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        map.setView([lat, lng], 8);
        currentLocationMarker = L.circleMarker([lat, lng], { radius: 8, color: '#22c55e', fillOpacity: 0.9 }).addTo(map).bindPopup('You are here');
      });
    }
  }
  setTimeout(() => map.invalidateSize(), 80);
}

detectDeviceTheme();
renderRecentSearches();
setupMobileNav();
themeToggleBtn.onclick = () => {
  const dark = !document.body.classList.contains('dark-theme');
  document.body.classList.toggle('dark-theme', dark);
  themeToggleBtn.textContent = dark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  localStorage.setItem('themeMode', dark ? 'dark' : 'light');
};
