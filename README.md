# Weather App

A browser-based weather dashboard that helps users quickly check current conditions and 5-day forecasts for any city, coordinates, or selected map location.

## Project Description

This project is a single-page weather application built with plain HTML/CSS/JavaScript and Leaflet maps. It integrates OpenWeather APIs to deliver:

- Current weather by city, geolocation, or map click.
- 5-day forecast summaries with average and min/max temperatures.
- Air Quality Index (AQI) lookup for the active location.
- Autocomplete city search with keyboard support.
- Unit switching between Celsius and Fahrenheit.
- Theme preference persistence (light/dark).
- Recent search persistence with quick re-run chips.

## Features

- **Search options**
  - Manual city search
  - Browser geolocation lookup
  - Interactive map-based selection
- **Data insights**
  - Temperature + feels-like
  - Humidity, pressure, wind speed
  - Sunrise/sunset display
  - AQI level label (Good to Very Poor)
- **User experience**
  - Debounced autocomplete
  - Enter-to-search
  - Loading state feedback
  - Persistent theme and recent searches

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- [Leaflet](https://leafletjs.com/)
- [OpenStreetMap tiles](https://www.openstreetmap.org/)
- [OpenWeather API](https://openweathermap.org/api)

## Developer

Built by **Ugoyoungking**.

- Portfolio: https://ugoyoungking.github.io/portfolio/

## Run Locally

1. Clone/download this repository.
2. Open `index.html` in your browser.
3. Ensure internet connectivity for API and map tiles.

## Notes

- The app currently uses an OpenWeather API key embedded in the client source for demo convenience.
- For production use, move API handling behind a secure backend/service layer.
