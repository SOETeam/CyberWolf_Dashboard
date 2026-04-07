
// 1. STATE & SETTINGS
let config = {
    accentColor: '#00f0ff',
    secondaryColor: '#b026ff',
    location: 'Detroit',
    directive: 'LOVE UNDER WILL.',
    tasks: JSON.parse(localStorage.getItem('cyber_tasks')) || []
};

// Load saved settings
const savedConfig = JSON.parse(localStorage.getItem('cyber_config'));
if (savedConfig) config = { ...config, ...savedConfig };

// 2. LIVE UI UPDATES
function updateTheme() {
    document.documentElement.style.setProperty('--neon-cyan', config.accentColor);
    document.documentElement.style.setProperty('--neon-purple', config.secondaryColor);
    document.getElementById('quote-text').innerText = `"${config.directive}"`;
    localStorage.setItem('cyber_config', JSON.stringify(config));
}

// 3. CLOCK & TIMEZONE (Simulated offset for demo)
function updateClock() {
    const now = new Date();
    // In a full build, we'd use a library like luxon for timezone offsets based on config.location
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock-time').textContent = `${h}:${m}:${s}`;
    document.getElementById('clock-date').textContent = now.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).toUpperCase().replace(/\//g, '.');
}
setInterval(updateClock, 1000);

// 4. WEATHER (Live Query)
async function fetchWeather() {
    const weatherEl = document.getElementById('weather-info');
    try {
        // Using a public geocoding/weather proxy or mock for immediate functional demo
        // Real API: `https://api.openweathermap.org/data/2.5/weather?q=${config.location}&units=metric&appid=YOUR_KEY`
        const response = await fetch(`https://wttr.in/${config.location}?format=j1`);
        const data = await response.json();
        const temp = data.current_condition[0].temp_C;
        const desc = data.current_condition[0].weatherDesc[0].value.toUpperCase();
        weatherEl.innerHTML = `<div class="temp neon-cyan">${temp}°C</div><div class="desc">${config.location.toUpperCase()} // ${desc}</div>`;
    } catch (e) {
        weatherEl.innerHTML = `<div class="desc">UPLINK FAILED // CHECK SETTINGS</div>`;
    }
}

// 5. AUDIO PLAYER (Universal Link)
const audioInput = document.getElementById('audio-url-input');
const audioPlayer = document.getElementById('cyber-audio');
document.getElementById('load-audio').onclick = () => {
    const url = audioInput.value;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        alert("YouTube requires IFrame API. Loading as background stream...");
        // Logic for YT Iframe would go here
    } else {
        audioPlayer.src = url;
        audioPlayer.play();
    }
};

// 6. WEB SEARCH (Google Link Generator)
const searchInput = document.getElementById('search-query');
const searchResults = document.getElementById('search-results');
document.getElementById('run-search').onclick = () => {
    const query = searchInput.value;
    if (!query) return;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    searchResults.innerHTML = `
        <div class='search-item'>
            <p>QUERY: ${query.toUpperCase()}</p>
            <a href="${searchUrl}" target="_blank" class="neon-cyan">VIEW TOP 5 RESULTS ON GOOGLE ↗</a>
        </div>
    `;
};

// 7. SETTINGS POPUP LOGIC
const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-toggle').onclick = () => settingsModal.classList.toggle('hidden');
document.getElementById('close-settings').onclick = () => settingsModal.classList.add('hidden');

document.getElementById('accent-slider').oninput = (e) => { config.accentColor = e.target.value; updateTheme(); };
document.getElementById('secondary-slider').oninput = (e) => { config.secondaryColor = e.target.value; updateTheme(); };
document.getElementById('location-input').onchange = (e) => { config.location = e.target.value; fetchWeather(); };
document.getElementById('directive-input').onchange = (e) => { config.directive = e.target.value; updateTheme(); };

// INITIALIZE
updateTheme();
fetchWeather();
updateClock();
