const STORAGE_KEY = 'sov-godt-sleep-log-v1';
const SETTINGS_KEY = 'sov-godt-settings-v1';
const ACTIVITY_KEY = 'sov-godt-night-activity-v1';
const COFFEE_CUP_CAFFEINE_MG = 80;
const today = new Date();
const dateKey = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
let isDemoData = false;
const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const timeMinutes = (time) => {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
const durationBetween = (start, end) => {
  const first = timeMinutes(start);
  const last = timeMinutes(end);
  if (first === null || last === null) return null;
  return (last - first + 1440) % 1440;
};
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return '–';
  return `${Math.floor(minutes / 60)} t ${Math.round(minutes % 60)} min`;
};
const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
const getSleepMinutes = (entry) => {
  const asleepToWake = durationBetween(entry.sleepOnset, entry.finalWake || entry.riseTime);
  return asleepToWake === null ? null : Math.max(0, asleepToWake - safeNumber(entry.awakeMinutes));
};
const getEfficiency = (entry) => {
  const inBed = durationBetween(entry.lightsOut || entry.bedtime, entry.riseTime);
  const asleep = getSleepMinutes(entry);
  return inBed && asleep !== null ? Math.min(100, Math.round(asleep / inBed * 100)) : null;
};

function seedEntries() {
  const samples = [
    [6.8, 23, 8, 7.3, 4], [7.1, 18, 7, 7.2, 4], [6.4, 35, 18, 7.6, 3],
    [7.3, 15, 6, 7.1, 4], [6.6, 28, 12, 7.4, 3], [7.2, 20, 7, 7.3, 4],
    [7.0, 17, 9, 7.2, 4], [6.5, 31, 16, 7.5, 3], [7.4, 14, 5, 7.2, 4],
    [6.9, 25, 10, 7.4, 4], [6.3, 39, 20, 7.8, 3], [7.5, 13, 5, 7.1, 5],
    [6.8, 22, 8, 7.3, 4], [7.2, 18, 6, 7.2, 4], [6.7, 30, 13, 7.5, 3],
    [7.1, 17, 7, 7.2, 4], [7.4, 14, 5, 7.2, 4], [6.6, 33, 15, 7.6, 3],
    [7.3, 16, 8, 7.3, 4], [7.0, 22, 10, 7.3, 4], [6.5, 37, 17, 7.7, 3],
    [7.5, 14, 6, 7.1, 4], [6.9, 23, 9, 7.4, 4], [7.2, 18, 7, 7.2, 4],
    [6.6, 31, 14, 7.5, 3], [7.4, 15, 6, 7.2, 4], [7.0, 20, 8, 7.3, 4],
    [6.7, 28, 12, 7.5, 3], [7.3, 16, 7, 7.2, 4], [7.1, 19, 8, 7.2, 4],
  ];
  return samples.map(([hours, latency, awake, rise, quality], index) => {
    const date = addDays(today, index - (samples.length - 1));
    const riseMins = Math.round(rise * 60);
    const finalWake = riseMins - (index % 4 === 1 ? 12 : 7);
    const onset = ((finalWake - hours * 60 + awake + 1440) % 1440);
    const lights = ((onset - latency + 1440) % 1440);
    const bed = (lights - 15 + 1440) % 1440;
    const clock = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`;
    return {
      date: dateKey(date), bedtime: clock(bed), lightsOut: clock(lights), sleepOnset: clock(onset),
      awakenings: index % 3, awakeMinutes: awake, finalWake: clock(finalWake), riseTime: clock(riseMins),
      quality, energy: Math.max(1, quality - (index % 4 === 2 ? 1 : 0)), medication: '',
      alcohol: index % 6 === 1 ? 1 : 0, caffeine: index % 5 === 2 ? 240 : 120,
      nap: index % 8 === 3 ? 20 : 0, light: index % 3 === 0 ? 20 : 0, melatonin: 0,
    };
  });
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      isDemoData = true;
      return seedEntries();
    }
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error('Kunne ikke lese søvndagboken fra lokal lagring.', error);
    isDemoData = true;
    return seedEntries();
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch (error) {
    console.error('Kunne ikke lese innstillingene fra lokal lagring.', error);
    return {};
  }
}

let entries = loadEntries();
let settings = loadSettings();
function loadActivity() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || 'null');
    return saved && Array.isArray(saved.events) && Array.isArray(saved.drafts)
      ? { events: saved.events, drafts: saved.drafts, activeLightSessionId: saved.activeLightSessionId || null }
      : { events: [], drafts: [], activeLightSessionId: null };
  } catch (error) {
    console.error('Kunne ikke lese de lokale søvnhendelsene.', error);
    return { events: [], drafts: [], activeLightSessionId: null };
  }
}
let activity = loadActivity();

function saveActivity(next) {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
    activity = next;
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre søvnhendelsene lokalt.', error);
    showToast('Hendelsen kunne ikke lagres. Kontroller lagringsplassen i nettleseren.');
    return false;
  }
}

function clockFromTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function localDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatClock(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return time || '–';
  if (settings.clockFormat !== '12') return time;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) return time;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('nb-NO', {
    hour: 'numeric', minute: '2-digit', hourCycle: 'h12',
  });
}

function displayClockFromTimestamp(timestamp) {
  return formatClock(clockFromTimestamp(timestamp));
}

function clockInputLocale() {
  return settings.clockFormat === '12' ? 'en-US' : 'en-GB';
}

function applyClockFormat() {
  const format = settings.clockFormat === '12' ? '12' : '24';
  document.querySelector('#clock-format').value = format;
  const inputLocale = clockInputLocale();
  document.querySelectorAll('input[type="time"], input[type="datetime-local"]').forEach((input) => {
    input.lang = inputLocale;
  });
  renderSleepWindow();
  for (const [statusId, enabledKey, timeKey] of [
    ['reminder-status', 'lightReminder', 'lightTime'],
    ['melatonin-status', 'melatoninReminder', 'melatoninTime'],
  ]) {
    document.querySelector(`#${statusId}`).textContent = settings[enabledKey]
      ? `${formatClock(settings[timeKey])} · appen åpen`
      : 'Ikke aktivert';
  }
}

function activeDraft() {
  return activity.drafts.find((draft) => draft.status === 'active') || null;
}

function draftEvents(draft) {
  return activity.events.filter((event) => draft.eventIds.includes(event.id));
}

function eventLabel(event) {
  return ({
    bed: 'I seng',
    wake: 'Stått opp',
    caffeine: 'Kaffe',
    alcohol: 'Alkohol',
    lightStart: 'Start lysbehandling',
    lightStop: 'Stopp lysbehandling',
  })[event.type] || 'Hendelse';
}

function formatEventAmount(event) {
  if (event.amount === null || event.amount === undefined) return '';
  if (event.type === 'caffeine') {
    if (event.amountUnit === 'coffee-cups') {
      return `${event.amount} ${Number(event.amount) === 1 ? 'kopp' : 'kopper'}`;
    }
    return `${event.amount} mg`;
  }
  return event.type === 'alcohol' ? `${event.amount} enheter` : '';
}

function formatNightEvents(events = [], useDisplayFormat = false) {
  return events.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((event) => `${eventLabel(event)} ${useDisplayFormat ? displayClockFromTimestamp(event.timestamp) : clockFromTimestamp(event.timestamp)}${formatEventAmount(event) ? ` (${formatEventAmount(event)})` : ''}`)
    .join(', ');
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre søvndagboken lokalt.', error);
    showToast('Kunne ikke lagre lokalt. Kontroller lagringsplassen i nettleseren.');
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre innstillingene lokalt.', error);
    showToast('Kunne ikke lagre innstillingen på denne enheten.');
    return false;
  }
}

function average(items) {
  const values = items.filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function getEntries(days = 7) {
  const cutoff = dateKey(addDays(today, -(days - 1)));
  return entries.filter((entry) => entry.date >= cutoff && entry.date <= dateKey(today))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getBedtimeMinutes(entry) {
  const value = timeMinutes(entry.lightsOut || entry.bedtime);
  return value === null ? null : (value < 720 ? value + 1440 : value);
}

function circularStdDev(times) {
  if (times.length < 2) return null;
  const radians = times.map((value) => value * Math.PI / 720);
  const sin = average(radians.map(Math.sin));
  const cos = average(radians.map(Math.cos));
  const resultant = Math.sqrt((sin || 0) ** 2 + (cos || 0) ** 2);
  return Math.sqrt(Math.max(0, -2 * Math.log(Math.max(resultant, .0001)))) * 720 / Math.PI;
}

function renderChart(target, data, color, label) {
  if (!target) return;
  const width = 640;
  const height = 145;
  const pad = { top: 12, right: 8, bottom: 20, left: 8 };
  const usableW = width - pad.left - pad.right;
  const usableH = height - pad.top - pad.bottom;
  const points = data.map((item, index) => {
    const value = item.value ?? 0;
    const x = pad.left + (data.length < 2 ? usableW / 2 : index * usableW / (data.length - 1));
    const y = pad.top + usableH - Math.max(0, Math.min(1, value / item.max)) * usableH;
    return { x, y, item, value };
  });
  const grid = [0, .5, 1].map((fraction) => {
    const y = pad.top + usableH * fraction;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#edf0f5" stroke-dasharray="3 5"/>`;
  }).join('');
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${points.at(-1)?.x ?? width / 2} ${height - pad.bottom} L ${points[0]?.x ?? width / 2} ${height - pad.bottom} Z`;
  const bars = label === 'søvntid' ? points.map((point) => {
    const barHeight = height - pad.bottom - point.y;
    return `<rect x="${point.x - 4}" y="${point.y}" width="8" height="${barHeight}" rx="4" fill="${color}" opacity=".28"/>`;
  }).join('') : '';
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.3" fill="${color}" stroke="#fff" stroke-width="2"><title>${escapeHtml(point.item.label)}: ${Math.round(point.value)} ${label === 'søvntid' ? 'timer' : 'min'}</title></circle>`).join('');
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="fill-${label}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".16"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#fill-${label})"/>${bars}<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}

function renderDashboard() {
  const days = Number(document.querySelector('#home-period').value);
  const subset = getEntries(days);
  const sleep = average(subset.map(getSleepMinutes));
  const efficiency = average(subset.map(getEfficiency));
  const waso = average(subset.map((entry) => Number.isFinite(Number(entry.awakeMinutes)) ? Number(entry.awakeMinutes) : null));
  const wakeTimes = subset.map((entry) => timeMinutes(entry.riseTime)).filter(Number.isFinite);
  const wake = average(wakeTimes);
  const heroSleep = entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map(getSleepMinutes).find(Number.isFinite);
  document.querySelector('#hero-kicker-text').textContent = isDemoData ? 'EKSEMPELDATA · DEMOVISNING' : 'SISTE REGISTRERING';
  document.querySelector('#hero-caption').textContent = isDemoData
    ? 'Fiktive tall for å vise hvordan søvnoversikten kan se ut.'
    : 'Det er søvn – ikke perfeksjon – vi øver på.';
  document.querySelector('#hero-duration').textContent = formatDuration(heroSleep);
  document.querySelector('#average-sleep').textContent = formatDuration(sleep);
  document.querySelector('#average-efficiency').textContent = efficiency === null ? '–' : `${Math.round(efficiency)} %`;
  document.querySelector('#average-waso').textContent = formatDuration(waso);
  document.querySelector('#wake-average').textContent = wake === null ? '–' : formatClock(`${String(Math.floor(wake / 60)).padStart(2, '0')}:${String(Math.round(wake % 60)).padStart(2, '0')}`);

  const previousStart = dateKey(addDays(today, -(days * 2 - 1)));
  const previousEnd = dateKey(addDays(today, -days));
  const previous = entries.filter((entry) => entry.date >= previousStart && entry.date <= previousEnd);
  const previousSleep = average(previous.map(getSleepMinutes));
  const previousEfficiency = average(previous.map(getEfficiency));
  const previousWake = average(previous.map((entry) => timeMinutes(entry.riseTime)).filter(Number.isFinite));
  const setTrend = (selector, current, before, unit, circular = false) => {
    const element = document.querySelector(selector);
    if (current === null || before === null) {
      element.textContent = 'for lite data';
      return;
    }
    let difference = Math.round(current - before);
    if (circular && difference > 720) difference -= 1440;
    if (circular && difference < -720) difference += 1440;
    element.textContent = difference === 0 ? 'uendret' : `${difference > 0 ? '+' : '−'} ${Math.abs(difference)} ${unit}`;
  };
  setTrend('#sleep-trend', sleep, previousSleep, 'min');
  setTrend('#efficiency-trend', efficiency, previousEfficiency, 'pp');
  setTrend('#wake-trend', wake, previousWake, 'min', true);

  const weekday = subset.filter((entry) => {
    const day = new Date(`${entry.date}T12:00:00`).getDay();
    return day >= 1 && day <= 5;
  });
  const weekend = subset.filter((entry) => [0, 6].includes(new Date(`${entry.date}T12:00:00`).getDay()));
  const weekdayWake = average(weekday.map((entry) => timeMinutes(entry.riseTime)));
  const weekendWake = average(weekend.map((entry) => timeMinutes(entry.riseTime)));
  const delta = weekdayWake === null || weekendWake === null ? null : Math.round(weekendWake - weekdayWake);
  document.querySelector('#weekend-delta').textContent = delta === null ? '–' : `${delta >= 0 ? '+' : '−'} ${Math.abs(delta)} min`;
  document.querySelector('#insight-weekend-delta').textContent = delta === null ? '–' : `${delta >= 0 ? '+' : '−'} ${Math.abs(delta)} min`;
  const wakeStd = circularStdDev(subset.map((entry) => timeMinutes(entry.riseTime)).filter(Number.isFinite));
  document.querySelector('#consistency-score').textContent = wakeStd === null ? '± –' : `± ${Math.round(wakeStd)}`;
  document.querySelector('#consistency-title').textContent = wakeStd === null ? 'Logg flere netter' : 'Typisk variasjon';
  document.querySelector('#consistency-copy').textContent = wakeStd === null
    ? 'Etter noen netter kan vi vise variasjonen i oppståtiden.'
    : 'Beregnet fra oppståtidene du har registrert.';

  const chartEntries = subset.slice().reverse();
  document.querySelector('#chart-range-start').textContent = chartEntries.length ? shortDate(chartEntries[0].date) : 'Ingen data';
  document.querySelector('#chart-range-end').textContent = chartEntries.length ? shortDate(chartEntries[chartEntries.length - 1].date) : 'Ingen data';
  renderChart(document.querySelector('#sleep-chart'), chartEntries.map((entry) => ({
    value: (getSleepMinutes(entry) || 0) / 60, max: 10, label: shortDate(entry.date),
  })), '#708bdf', 'søvntid');
  const recent = getEntries(7);
  document.querySelector('#log-count').textContent = `${recent.length} av 7`;
  document.querySelector('.goal-progress span').style.width = `${Math.min(100, recent.length / 7 * 100)}%`;
  document.querySelector('.goal-copy').textContent = `${recent.length} ${recent.length === 1 ? 'natt' : 'netter'} registrert denne uken.`;
  const daysWithLight = recent.filter((entry) => safeNumber(entry.light) > 0).length;
  const lightMinutes = recent.reduce((sum, entry) => sum + safeNumber(entry.light), 0);
  document.querySelector('#light-count').textContent = `${daysWithLight} ${daysWithLight === 1 ? 'dag' : 'dager'}`;
  document.querySelector('#light-minutes').textContent = `${lightMinutes} min`;
  renderInsights(subset);
  renderDiary();
  renderTreatmentSummary();
  renderQuickState();
}

function renderDiary() {
  const days = Number(document.querySelector('#diary-period').value);
  const list = getEntries(days);
  const body = document.querySelector('#diary-rows');
  document.querySelector('#diary-empty').hidden = list.length > 0;
  body.innerHTML = list.map((entry) => {
    const quality = Number(entry.quality);
    const profile = Array.isArray(entry.treatment) ? entry.treatment.map((item) => treatmentNames[item]).filter(Boolean).join(' og ') : '';
    return `<tr><td>${shortDate(entry.date)}</td><td>${formatClock(entry.bedtime)}</td><td>${formatClock(entry.sleepOnset)}</td><td>${formatClock(entry.riseTime)}</td><td>${formatDuration(getSleepMinutes(entry))}</td><td>${getEfficiency(entry) ?? '–'}${getEfficiency(entry) === null ? '' : ' %'}</td><td><span class="quality-pill">${quality ? `${quality} / 5` : '–'}</span></td><td>${escapeHtml(profile || '–')}</td><td>${escapeHtml(formatNightEvents(entry.events, true) || '–')}</td></tr>`;
  }).join('');
}

function renderInsights(subset) {
  const caffeineGroup = subset.filter((entry) => safeNumber(entry.caffeine) > 0 || safeNumber(entry.caffeineEvents) > 0);
  const lowCaffeine = caffeineGroup.filter((entry) => safeNumber(entry.caffeine) > 0 && safeNumber(entry.caffeine) <= 150);
  const highCaffeine = caffeineGroup.filter((entry) => safeNumber(entry.caffeine) > 150);
  const lowLatency = average(lowCaffeine.map((entry) => durationBetween(entry.lightsOut, entry.sleepOnset)));
  const highLatency = average(highCaffeine.map((entry) => durationBetween(entry.lightsOut, entry.sleepOnset)));
  const enoughData = lowCaffeine.length >= 2 && highCaffeine.length >= 2 && lowLatency !== null && highLatency !== null;
  document.querySelector('#caffeine-insight').textContent = enoughData ? 'En mulig sammenheng å utforske' : 'Slik ser det ut hos deg';
  document.querySelector('#caffeine-copy').textContent = enoughData
    ? `I loggene med over 150 mg koffein var innsovningstiden i snitt ${Math.round(highLatency - lowLatency)} min ${highLatency >= lowLatency ? 'lengre' : 'kortere'} enn ved lavere inntak. Dette viser ikke at koffein var årsaken.`
    : caffeineGroup.some((entry) => safeNumber(entry.caffeineEvents) > 0 && safeNumber(entry.caffeine) === 0)
      ? 'Koffein er registrert, men mengden mangler. Legg gjerne til omtrentlig mengde for å sammenligne gruppene.'
      : 'Registrer noen flere dager med koffein og søvn for å se om det finnes et mønster.';
  const bars = subset.slice(0, 7).reverse().map((entry) => {
    const height = Math.max(7, Math.min(28, safeNumber(entry.caffeine) / 10 || (safeNumber(entry.caffeineEvents) ? 9 : 0)));
    return `<span title="${safeNumber(entry.caffeine) ? `${safeNumber(entry.caffeine)} mg koffein` : `${safeNumber(entry.caffeineEvents)} kaffehendelser`}" style="height:${height}px"></span>`;
  }).join('');
  document.querySelector('#caffeine-chart').innerHTML = bars || '<span style="height:7px"></span>';

  const withAlcohol = subset.filter((entry) => safeNumber(entry.alcohol) > 0 || safeNumber(entry.alcoholEvents) > 0);
  const withoutAlcohol = subset.filter((entry) => safeNumber(entry.alcohol) === 0 && safeNumber(entry.alcoholEvents) === 0);
  const alcoholSleep = average(withAlcohol.map(getSleepMinutes));
  const noAlcoholSleep = average(withoutAlcohol.map(getSleepMinutes));
  const compareAlcohol = withAlcohol.length >= 2 && withoutAlcohol.length >= 2 && alcoholSleep !== null && noAlcoholSleep !== null;
  document.querySelector('#alcohol-insight').textContent = compareAlcohol ? 'En mulig sammenheng å utforske' : 'Slik ser det ut hos deg';
  document.querySelector('#alcohol-copy').textContent = compareAlcohol
    ? `Estimert søvntid var i snitt ${Math.abs(Math.round(alcoholSleep - noAlcoholSleep))} min ${alcoholSleep >= noAlcoholSleep ? 'lengre' : 'kortere'} på netter med alkohol enn på netter uten. Dette viser ikke at alkohol var årsaken.`
    : 'Registrer noen flere netter både med og uten alkohol for å sammenligne søvnmønstrene.';
  const compareScale = Math.max(alcoholSleep || 0, noAlcoholSleep || 0, 1);
  document.querySelector('#alcohol-chart').innerHTML = `<div><i style="width:${Math.max(5, (alcoholSleep || 0) / compareScale * 100)}%"></i>Med alkohol</div><div><i style="width:${Math.max(5, (noAlcoholSleep || 0) / compareScale * 100)}%"></i>Uten</div>`;
  const napDays = subset.filter((entry) => safeNumber(entry.nap) > 0).length;
  document.querySelector('#hygiene-copy').textContent = `Du har registrert dagsøvn ${napDays} ${napDays === 1 ? 'dag' : 'dager'} i denne perioden. Sammenlign nettene, uten å anta at dagsøvnen var årsaken.`;
  renderChart(document.querySelector('#latency-chart'), subset.slice().reverse().map((entry) => ({
    value: durationBetween(entry.lightsOut, entry.sleepOnset) ?? 0, max: 60, label: shortDate(entry.date),
  })), '#6fc9be', 'innsovningstid');
}

function setView(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
  document.querySelectorAll('[data-view]').forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-current', selected ? 'page' : 'false');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

const treatmentNames = { insomnia: 'Insomni', 'delayed-phase': 'Forsinket søvnfase' };
const selectedTreatments = () => Array.isArray(settings.treatments) ? settings.treatments : [];
const hasInsomnia = () => selectedTreatments().includes('insomnia');
const hasDelayedPhase = () => selectedTreatments().includes('delayed-phase');
let currentDraftId = null;
let pendingIntakeEventId = null;

function renderTreatmentSummary() {
  const selected = selectedTreatments();
  const summary = selected.length ? selected.map((key) => treatmentNames[key]).filter(Boolean).join(' og ') : 'Ikke valgt ennå';
  document.querySelector('#treatment-summary').textContent = selected.length
    ? `Dagboken tilpasses: ${summary}. Du kan endre valget senere.`
    : 'Velg ett eller begge områder. Du kan endre valget senere.';
  document.querySelector('#plan-treatment-summary').textContent = selected.length
    ? `Valgt: ${summary}. Dette tilpasser spørsmålene i nattregistreringen, ikke behandlingen.`
    : 'Velg hva du får behandling for, slik at nattregistreringen viser relevante spørsmål.';
  document.querySelector('#treatment-choice-title').textContent = selected.length ? 'Behandlingsprofilen din' : 'Hva får du behandling for?';
  document.querySelectorAll('.form-insomnia').forEach((field) => { field.hidden = !hasInsomnia(); });
  document.querySelectorAll('.form-delayed').forEach((field) => { field.hidden = !hasDelayedPhase(); });
  const hint = document.querySelector('#profile-hint');
  hint.hidden = selected.length > 0;
  hint.textContent = 'Velg behandlingsområde under «Min plan» for å tilpasse spørsmålene. Søvnregistreringen kan lagres uten valg.';
  updateQuickActionVisibility();
}

function cloneActivity() {
  return JSON.parse(JSON.stringify(activity));
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEvent(type, timestamp = new Date(), details = {}) {
  return { id: newId(), type, timestamp: timestamp.toISOString(), amount: null, ...details };
}

function renderSleepWindow() {
  document.querySelector('#sleep-window-bedtime').textContent = settings.sleepWindowBedtime
    ? formatClock(settings.sleepWindowBedtime)
    : '– – : – –';
  document.querySelector('#sleep-window-wake-time').textContent = settings.sleepWindowWakeTime
    ? formatClock(settings.sleepWindowWakeTime)
    : '– – : – –';
}

function allAssignedEventIds(state = activity) {
  return new Set(state.drafts.flatMap((draft) => draft.eventIds));
}

function lastWakeTimestamp(state = activity) {
  return state.events.filter((event) => event.type === 'wake')
    .map((event) => Date.parse(event.timestamp)).filter(Number.isFinite).sort((a, b) => b - a)[0] || 0;
}

function attachEvent(state, draft, event) {
  if (!state.events.some((item) => item.id === event.id)) state.events.push(event);
  event.draftId = draft.id;
  if (!draft.eventIds.includes(event.id)) draft.eventIds.push(event.id);
}

function createNightDraft(bedtimeEvent, status = 'active') {
  const state = cloneActivity();
  const timestamp = new Date(bedtimeEvent.timestamp);
  const nightDate = dateKey(timestamp.getHours() < 6 ? timestamp : addDays(timestamp, 1));
  const draft = {
    id: newId(), date: nightDate, status, eventIds: [], bedtime: clockFromTimestamp(bedtimeEvent.timestamp),
    riseTime: '', startedAt: bedtimeEvent.timestamp, updatedAt: bedtimeEvent.timestamp,
  };
  const cutoff = Math.max(lastWakeTimestamp(state), timestamp.getTime() - 24 * 60 * 60 * 1000);
  for (const event of state.events) {
    const eventTime = Date.parse(event.timestamp);
    if (!event.draftId && eventTime >= cutoff && eventTime <= timestamp.getTime()
      && ['caffeine', 'alcohol', 'lightStart', 'lightStop'].includes(event.type)) attachEvent(state, draft, event);
  }
  attachEvent(state, draft, bedtimeEvent);
  state.drafts.push(draft);
  if (!saveActivity(state)) return null;
  return draft;
}

function renderQuickState() {
  const now = new Date();
  document.querySelector('#live-time').textContent = displayClockFromTimestamp(now.toISOString());
  const draft = activeDraft();
  const activeNight = document.querySelector('#active-night');
  activeNight.hidden = !draft;
  activeNight.innerHTML = draft ? `<i></i><strong>Nattutkast pågår</strong> · startet ${escapeHtml(formatClock(draft.bedtime || clockFromTimestamp(draft.startedAt)))}` : '';
  document.querySelector('#log-bed').disabled = Boolean(draft);
  document.querySelector('#log-light-stop').disabled = !activity.activeLightSessionId;
  updateQuickActionVisibility();
  const recent = activity.events.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 4);
  const recentElement = document.querySelector('#recent-events');
  recentElement.hidden = recent.length === 0;
  recentElement.innerHTML = recent.length
    ? recent.map((event) => `<span>${escapeHtml(eventLabel(event))} · ${escapeHtml(displayClockFromTimestamp(event.timestamp))}</span>`).join('')
    : '';

  const pending = activity.drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const card = document.querySelector('#draft-card');
  card.hidden = !pending;
  if (pending) {
    document.querySelector('#draft-status').textContent = pending.status === 'ready' ? 'KLAR TIL FERDIGSTILLING' : 'NATTUTKAST · IKKE FERDIG';
    document.querySelector('#draft-title').textContent = pending.status === 'ready' ? 'Natten er klar til ferdigstilling' : 'Vil du fortsette nattutkastet?';
    document.querySelector('#draft-description').textContent = pending.riseTime
      ? `${shortDate(pending.date)} · Sto opp ${pending.riseTime}`
      : `${shortDate(pending.date)} · Oppståtid mangler ennå`;
  }
}

function updateQuickActionVisibility() {
  document.querySelectorAll('.quick-action[data-treatment]').forEach((button) => {
    const relevant = selectedTreatments().includes(button.dataset.treatment);
    const canStopActiveLight = button.id === 'log-light-stop' && Boolean(activity.activeLightSessionId);
    button.hidden = !relevant && !canStopActiveLight;
  });
}

function updateProfileDialog() {
  document.querySelectorAll('#treatment-form input[name="treatment"]').forEach((input) => {
    input.checked = selectedTreatments().includes(input.value);
  });
  document.querySelector('#treatment-error').hidden = true;
}

function renderEventReview(draft) {
  const container = document.querySelector('#event-review');
  const list = draftEvents(draft).filter((event) => !['bed', 'wake'].includes(event.type))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  container.hidden = list.length === 0;
  if (!list.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<h3>Hendelser registrert i natt</h3><ul class="event-list">${list.map((event) => {
    const amountText = formatEventAmount(event);
    return `<li><span>${escapeHtml(eventLabel(event))}${amountText ? escapeHtml(` · ${amountText}`) : ''}</span><input lang="${clockInputLocale()}" aria-label="Tidspunkt for ${escapeHtml(eventLabel(event))}" type="datetime-local" value="${escapeHtml(localDateTime(new Date(event.timestamp)))}" data-event-time="${escapeHtml(event.id)}">${['caffeine', 'alcohol'].includes(event.type) ? `<button type="button" aria-label="Fjern ${escapeHtml(eventLabel(event))}" data-remove-event="${escapeHtml(event.id)}">×</button>` : ''}</li>`;
  }).join('')}</ul>`;
  applyClockFormat();
}

function latestPendingDraft() {
  return activity.drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
}

function openLog(draft = latestPendingDraft()) {
  if (!draft) {
    const state = cloneActivity();
    draft = {
      id: newId(), date: dateKey(addDays(new Date(), -1)), status: 'ready', eventIds: [],
      bedtime: '', riseTime: '', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    state.drafts.push(draft);
    if (!saveActivity(state)) return;
  }
  currentDraftId = draft.id;
  const form = document.querySelector('#sleep-form');
  form.reset();
  const relatedEvents = draftEvents(draft);
  const bed = relatedEvents.find((event) => event.type === 'bed');
  const wake = relatedEvents.find((event) => event.type === 'wake');
  const bedtime = draft.bedtime || (bed ? clockFromTimestamp(bed.timestamp) : '');
  const riseTime = draft.riseTime || (wake ? clockFromTimestamp(wake.timestamp) : '');
  form.elements.date.value = draft.date || dateKey(addDays(new Date(), -1));
  form.elements.bedtime.value = bedtime;
  form.elements.riseTime.value = riseTime;
  form.elements.lightsOut.value = bedtime;
  form.elements.sleepOnset.value = bedtime;
  form.elements.finalWake.value = riseTime;
  form.elements.awakenings.value = '0';
  form.elements.awakeMinutes.value = '0';
  form.elements.nap.value = '0';
  form.elements.melatonin.value = '0';
  document.querySelector('#form-error').hidden = true;
  renderEventReview(draft);
  renderTreatmentSummary();
  document.querySelector('#log-dialog').showModal();
  form.elements.bedtime.focus();
}

function logBedtime() {
  if (activeDraft()) {
    showToast('Nattutkastet er allerede i gang.');
    return;
  }
  const bedtimeEvent = createEvent('bed');
  const draft = createNightDraft(bedtimeEvent);
  if (!draft) return;
  renderDashboard();
  showToast(`I seng registrert kl. ${displayClockFromTimestamp(bedtimeEvent.timestamp)}.`);
}

function logWakeTime() {
  const state = cloneActivity();
  const timestamp = new Date();
  const wakeEvent = createEvent('wake', timestamp);
  let draft = state.drafts.find((item) => item.status === 'active');
  if (!draft) {
    draft = state.drafts.find((item) => item.status === 'ready' && !item.riseTime);
    if (!draft && entries.some((entry) => entry.date === dateKey(timestamp))) {
      showToast('Denne morgenen er allerede registrert.');
      return;
    }
    if (!draft) {
      draft = { id: newId(), date: dateKey(timestamp), status: 'ready', eventIds: [], bedtime: '', riseTime: '', startedAt: timestamp.toISOString() };
      state.drafts.push(draft);
      const cutoff = Math.max(lastWakeTimestamp(state), timestamp.getTime() - 24 * 60 * 60 * 1000);
      for (const event of state.events) {
        const eventTime = Date.parse(event.timestamp);
        if (!event.draftId && eventTime >= cutoff && eventTime <= timestamp.getTime()
          && ['caffeine', 'alcohol', 'lightStart', 'lightStop'].includes(event.type)) attachEvent(state, draft, event);
      }
    }
  }
  draft.status = 'ready';
  draft.riseTime = clockFromTimestamp(timestamp);
  draft.wakeAt = timestamp.toISOString();
  draft.updatedAt = timestamp.toISOString();
  attachEvent(state, draft, wakeEvent);
  if (!saveActivity(state)) return;
  renderDashboard();
  showToast(`Stått opp registrert kl. ${draft.riseTime}. Nattutkastet er klart til ferdigstilling.`);
}

function logIntake(type) {
  const state = cloneActivity();
  const event = createEvent(type);
  if (type === 'caffeine') {
    event.amount = 1;
    event.amountUnit = 'coffee-cups';
  }
  const draft = state.drafts.find((item) => item.status === 'active');
  if (draft) attachEvent(state, draft, event);
  else state.events.push(event);
  if (!saveActivity(state)) return;
  pendingIntakeEventId = event.id;
  const isCoffee = type === 'caffeine';
  document.querySelector('#intake-title').textContent = isCoffee ? 'Kaffe registrert' : 'Alkohol registrert';
  document.querySelector('#intake-description').textContent = isCoffee
    ? `Tidspunktet ${displayClockFromTimestamp(event.timestamp)} er lagret. Én kopp er valgt som standard.`
    : `Tidspunktet ${displayClockFromTimestamp(event.timestamp)} er lagret. Mengde er valgfritt.`;
  document.querySelector('#intake-label').textContent = isCoffee ? 'Kaffekopper' : 'Alkohol omtrent (enheter)';
  const intakeHint = document.querySelector('#intake-hint');
  intakeHint.hidden = !isCoffee;
  intakeHint.textContent = `1 kopp tilsvarer ${COFFEE_CUP_CAFFEINE_MG} mg koffein.`;
  const amount = document.querySelector('#intake-amount');
  amount.value = isCoffee ? '1' : '';
  amount.step = isCoffee ? '0.5' : 'any';
  amount.placeholder = isCoffee ? 'For eksempel 1' : 'For eksempel 1';
  document.querySelector('#intake-dialog').showModal();
  amount.focus();
  renderDashboard();
}

function startLightSession() {
  if (activity.activeLightSessionId) {
    showToast('Lysbehandling er allerede startet.');
    return;
  }
  const state = cloneActivity();
  const event = createEvent('lightStart');
  event.sessionId = newId();
  const draft = state.drafts.find((item) => item.status === 'active');
  if (draft) attachEvent(state, draft, event);
  else state.events.push(event);
  state.activeLightSessionId = event.sessionId;
  if (!saveActivity(state)) return;
  renderDashboard();
  showToast(`Lysbehandling startet kl. ${displayClockFromTimestamp(event.timestamp)}.`);
}

function stopLightSession() {
  if (!activity.activeLightSessionId) {
    showToast('Start lysbehandlingen før du stopper den.');
    return;
  }
  const state = cloneActivity();
  const start = state.events.find((event) => event.sessionId === state.activeLightSessionId && event.type === 'lightStart');
  if (!start) {
    showToast('Fant ikke starttidspunktet. Start lysbehandlingen på nytt.');
    return;
  }
  const stop = createEvent('lightStop', new Date(), { sessionId: state.activeLightSessionId });
  const durationMinutes = Math.max(0, Math.round((Date.parse(stop.timestamp) - Date.parse(start.timestamp)) / 60000));
  start.durationMinutes = durationMinutes;
  const draft = state.drafts.find((item) => item.status === 'active');
  if (draft) {
    attachEvent(state, draft, start);
    attachEvent(state, draft, stop);
  } else state.events.push(stop);
  state.activeLightSessionId = null;
  if (!saveActivity(state)) return;
  renderDashboard();
  showToast(`Lysbehandling registrert: ${durationMinutes} min.`);
}

function setEventTimestamp(eventId, value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const state = cloneActivity();
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return false;
  event.timestamp = parsed.toISOString();
  const draft = state.drafts.find((item) => item.id === event.draftId);
  if (draft && event.type === 'bed') draft.bedtime = clockFromTimestamp(event.timestamp);
  if (draft && event.type === 'wake') {
    draft.riseTime = clockFromTimestamp(event.timestamp);
    draft.wakeAt = event.timestamp;
  }
  return saveActivity(state);
}

function openIntakeAmount(eventId) {
  const state = cloneActivity();
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  event.amount = safeNumber(document.querySelector('#intake-amount').value);
  if (event.type === 'caffeine') event.amountUnit = 'coffee-cups';
  if (!saveActivity(state)) return;
  document.querySelector('#intake-dialog').close();
  pendingIntakeEventId = null;
  renderDashboard();
  showToast('Mengden er lagt til.');
}

document.querySelector('#today-label').textContent = today.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-view-link]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.viewLink)));
document.querySelectorAll('[data-open-log]').forEach((button) => button.addEventListener('click', () => openLog()));
document.querySelectorAll('[data-open-treatment]').forEach((button) => button.addEventListener('click', () => {
  updateProfileDialog();
  document.querySelector('#treatment-dialog').showModal();
}));
document.querySelectorAll('[data-close-log]').forEach((button) => button.addEventListener('click', () => document.querySelector('#log-dialog').close()));
document.querySelectorAll('[data-close-treatment]').forEach((button) => button.addEventListener('click', () => document.querySelector('#treatment-dialog').close()));
document.querySelectorAll('[data-close-intake]').forEach((button) => button.addEventListener('click', () => document.querySelector('#intake-dialog').close()));
document.querySelector('#home-period').addEventListener('change', renderDashboard);
document.querySelector('#diary-period').addEventListener('change', renderDiary);
document.querySelector('#clock-format').addEventListener('change', (event) => {
  const previous = settings.clockFormat;
  settings.clockFormat = event.currentTarget.value;
  if (!saveSettings()) {
    if (previous === undefined) delete settings.clockFormat;
    else settings.clockFormat = previous;
    event.currentTarget.value = settings.clockFormat || '24';
    return;
  }
  applyClockFormat();
  renderDashboard();
  showToast(`${settings.clockFormat}-timers klokke er valgt.`);
});
const sleepWindowForm = document.querySelector('#sleep-window-form');
const sleepWindowEditButton = document.querySelector('#edit-sleep-window');
function closeSleepWindowEditor() {
  sleepWindowForm.hidden = true;
  sleepWindowEditButton.hidden = false;
  sleepWindowEditButton.setAttribute('aria-expanded', 'false');
  document.querySelector('#sleep-window-error').hidden = true;
}
sleepWindowEditButton.addEventListener('click', () => {
  document.querySelector('#sleep-window-bedtime-input').value = settings.sleepWindowBedtime || '';
  document.querySelector('#sleep-window-wake-time-input').value = settings.sleepWindowWakeTime || '';
  document.querySelector('#sleep-window-error').hidden = true;
  sleepWindowForm.hidden = false;
  sleepWindowEditButton.hidden = true;
  sleepWindowEditButton.setAttribute('aria-expanded', 'true');
  document.querySelector('#sleep-window-bedtime-input').focus();
});
document.querySelector('#cancel-sleep-window').addEventListener('click', closeSleepWindowEditor);
sleepWindowForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const bedtime = document.querySelector('#sleep-window-bedtime-input').value;
  const wakeTime = document.querySelector('#sleep-window-wake-time-input').value;
  if (!bedtime || !wakeTime) {
    const error = document.querySelector('#sleep-window-error');
    error.textContent = 'Fyll inn både leggetid og oppståtid.';
    error.hidden = false;
    return;
  }
  const previousBedtime = settings.sleepWindowBedtime;
  const previousWakeTime = settings.sleepWindowWakeTime;
  settings.sleepWindowBedtime = bedtime;
  settings.sleepWindowWakeTime = wakeTime;
  if (!saveSettings()) {
    if (previousBedtime === undefined) delete settings.sleepWindowBedtime;
    else settings.sleepWindowBedtime = previousBedtime;
    if (previousWakeTime === undefined) delete settings.sleepWindowWakeTime;
    else settings.sleepWindowWakeTime = previousWakeTime;
    return;
  }
  renderSleepWindow();
  closeSleepWindowEditor();
  showToast('Søvnvinduet er lagret på denne enheten.');
});
document.querySelector('#log-bed').addEventListener('click', logBedtime);
document.querySelector('#log-wake').addEventListener('click', logWakeTime);
document.querySelector('#log-coffee').addEventListener('click', () => logIntake('caffeine'));
document.querySelector('#log-alcohol').addEventListener('click', () => logIntake('alcohol'));
document.querySelector('#log-light-start').addEventListener('click', startLightSession);
document.querySelector('#log-light-stop').addEventListener('click', stopLightSession);
document.querySelector('#finish-draft').addEventListener('click', () => openLog());
document.querySelector('#treatment-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const selected = [...document.querySelectorAll('#treatment-form input[name="treatment"]:checked')].map((input) => input.value);
  if (!selected.length) {
    document.querySelector('#treatment-error').hidden = false;
    return;
  }
  const previous = settings.treatments;
  settings.treatments = selected;
  if (!saveSettings()) {
    settings.treatments = previous;
    return;
  }
  document.querySelector('#treatment-dialog').close();
  renderDashboard();
  showToast('Behandlingsprofilen er lagret.');
});
document.querySelector('#intake-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pendingIntakeEventId || !document.querySelector('#intake-amount').value) return;
  openIntakeAmount(pendingIntakeEventId);
});
document.querySelector('#event-review').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-event]');
  if (!button || !currentDraftId) return;
  const state = cloneActivity();
  const id = button.dataset.removeEvent;
  state.events = state.events.filter((item) => item.id !== id);
  const draft = state.drafts.find((item) => item.id === currentDraftId);
  if (draft) draft.eventIds = draft.eventIds.filter((eventId) => eventId !== id);
  if (saveActivity(state)) renderEventReview(draft);
});
document.querySelector('#event-review').addEventListener('change', (event) => {
  const input = event.target.closest('[data-event-time]');
  if (!input) return;
  if (!setEventTimestamp(input.dataset.eventTime, input.value)) return;
  const draft = activity.drafts.find((item) => item.id === currentDraftId);
  if (draft) renderEventReview(draft);
});
document.querySelector('#sleep-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const error = document.querySelector('#form-error');
  const draft = activity.drafts.find((item) => item.id === currentDraftId);
  if (!values.bedtime || !values.sleepOnset || !values.riseTime
    || (hasInsomnia() && (!values.lightsOut || !values.finalWake))) {
    error.textContent = hasInsomnia()
      ? 'Fyll inn sengetid, lys av, sovnet, siste oppvåkning og oppståtid.'
      : 'Fyll inn sengetid, omtrent når du sovnet og oppståtid.';
    error.hidden = false;
    return;
  }
  const sleepPeriod = durationBetween(values.sleepOnset, values.finalWake || values.riseTime);
  if (sleepPeriod === null || (hasInsomnia() && safeNumber(values.awakeMinutes) > sleepPeriod)) {
    error.textContent = 'Våken tid kan ikke være lengre enn tiden fra du sovnet til du våknet.';
    error.hidden = false;
    return;
  }
  const related = draft ? draftEvents(draft) : [];
  const eventUpdates = new Map(related.map((item) => [item.id, { ...item }]));
  for (const input of document.querySelectorAll('[data-event-time]')) {
    const original = eventUpdates.get(input.dataset.eventTime);
    const updated = new Date(input.value);
    if (original && !Number.isNaN(updated.getTime())) original.timestamp = updated.toISOString();
  }
  const bedEvent = related.find((item) => item.type === 'bed');
  const wakeEvent = related.find((item) => item.type === 'wake');
  if (bedEvent) {
    const updated = new Date(bedEvent.timestamp);
    const [hour, minute] = values.bedtime.split(':').map(Number);
    updated.setHours(hour, minute, 0, 0);
    eventUpdates.get(bedEvent.id).timestamp = updated.toISOString();
  }
  if (wakeEvent) {
    const updated = new Date(wakeEvent.timestamp);
    const [hour, minute] = values.riseTime.split(':').map(Number);
    updated.setHours(hour, minute, 0, 0);
    eventUpdates.get(wakeEvent.id).timestamp = updated.toISOString();
  }
  const allNightEvents = [...eventUpdates.values()];
  const amountTotal = (type) => allNightEvents.filter((item) => item.type === type && Number.isFinite(Number(item.amount)))
    .reduce((sum, item) => sum + (type === 'caffeine' && item.amountUnit === 'coffee-cups'
      ? Number(item.amount) * COFFEE_CUP_CAFFEINE_MG
      : Number(item.amount)), 0);
  const caffeineCount = allNightEvents.filter((item) => item.type === 'caffeine').length;
  const alcoholCount = allNightEvents.filter((item) => item.type === 'alcohol').length;
  const lightMinutes = allNightEvents.filter((item) => item.type === 'lightStart')
    .reduce((sum, item) => sum + safeNumber(item.durationMinutes), 0);
  const record = {
    ...values, date: values.date, treatment: selectedTreatments(),
    awakenings: hasInsomnia() ? safeNumber(values.awakenings) : 0,
    awakeMinutes: hasInsomnia() ? safeNumber(values.awakeMinutes) : 0,
    quality: hasInsomnia() ? safeNumber(values.quality) : 0,
    energy: hasInsomnia() ? safeNumber(values.energy) : 0,
    medication: hasInsomnia() ? values.medication : '',
    nap: hasInsomnia() ? safeNumber(values.nap) : 0,
    melatonin: hasDelayedPhase() ? safeNumber(values.melatonin) : 0,
    caffeine: amountTotal('caffeine'), caffeineEvents: caffeineCount,
    alcohol: amountTotal('alcohol'), alcoholEvents: alcoholCount,
    light: lightMinutes, events: allNightEvents,
  };
  const nextActivity = cloneActivity();
  const persistedEvents = new Map(allNightEvents.map((item) => [item.id, item]));
  nextActivity.events = nextActivity.events.map((item) => {
    const updated = persistedEvents.get(item.id);
    return updated ? { ...updated, draftId: draft?.id || item.draftId } : item;
  });
  if (draft) nextActivity.drafts = nextActivity.drafts.filter((item) => item.id !== draft.id);
  const previousEntries = entries;
  const previousDemoState = isDemoData;
  if (isDemoData) entries = [];
  entries = [record, ...entries.filter((entry) => entry.date !== record.date)].sort((a, b) => b.date.localeCompare(a.date));
  isDemoData = false;
  if (!saveActivity(nextActivity)) {
    entries = previousEntries;
    isDemoData = previousDemoState;
    return;
  }
  if (!saveEntries()) {
    entries = previousEntries;
    isDemoData = previousDemoState;
    saveActivity(activity);
    return;
  }
  currentDraftId = null;
  document.querySelector('#log-dialog').close();
  renderDashboard();
  showToast('Natten er ferdig. Takk for innsjekken.');
});

document.querySelector('#today-label').textContent = today.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-view-link]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.viewLink)));
document.querySelectorAll('[data-open-log]').forEach((button) => button.addEventListener('click', openLog));
document.querySelectorAll('[data-close-log]').forEach((button) => button.addEventListener('click', () => document.querySelector('#log-dialog').close()));
document.querySelector('#home-period').addEventListener('change', renderDashboard);
document.querySelector('#diary-period').addEventListener('change', renderDiary);

let pendingReminder;
for (const [buttonId, settingKey, timeKey, statusId, label] of [
  ['light-reminder', 'lightReminder', 'lightTime', 'reminder-status', 'lysbehandling'],
  ['melatonin-reminder', 'melatoninReminder', 'melatoninTime', 'melatonin-status', 'melatonin'],
]) {
  const button = document.getElementById(buttonId);
  const updateReminder = () => {
    const active = Boolean(settings[settingKey]);
    button.setAttribute('aria-pressed', String(active));
    document.getElementById(statusId).textContent = active ? `${formatClock(settings[timeKey])} · appen åpen` : 'Ikke aktivert';
  };
  button.addEventListener('click', () => {
    if (settings[settingKey]) {
      settings[settingKey] = false;
      if (!saveSettings()) {
        settings[settingKey] = true;
        return;
      }
      updateReminder();
      showToast('Påminnelsen er slått av.');
      return;
    }
    pendingReminder = { settingKey, timeKey, label, update: updateReminder };
    document.querySelector('#reminder-time').value = settings[timeKey] || '';
    document.querySelector('#reminder-title').textContent = `Påminnelse om ${label}`;
    document.querySelector('#reminder-dialog').showModal();
    document.querySelector('#reminder-time').focus();
  });
  updateReminder();
}

document.querySelectorAll('[data-close-reminder]').forEach((button) => button.addEventListener('click', () => document.querySelector('#reminder-dialog').close()));
document.querySelector('#reminder-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pendingReminder) return;
  const previousActive = settings[pendingReminder.settingKey];
  const previousTime = settings[pendingReminder.timeKey];
  settings[pendingReminder.settingKey] = true;
  settings[pendingReminder.timeKey] = document.querySelector('#reminder-time').value;
  if (!saveSettings()) {
    settings[pendingReminder.settingKey] = previousActive;
    settings[pendingReminder.timeKey] = previousTime;
    return;
  }
  pendingReminder.update();
  pendingReminder = undefined;
  document.querySelector('#reminder-dialog').close();
  showToast('Påminnelsen vises i appen ved avtalt klokkeslett.');
});

function checkReminders() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const currentDate = dateKey(now);
  for (const [settingKey, timeKey, label] of [
    ['lightReminder', 'lightTime', 'Følg avtalen om lysbehandling.'],
    ['melatoninReminder', 'melatoninTime', 'Følg avtalen om melatonin.'],
  ]) {
    if (settings[settingKey] && settings[timeKey] === currentTime && settings[`${settingKey}LastDate`] !== currentDate) {
      settings[`${settingKey}LastDate`] = currentDate;
      showToast(label);
    }
  }
}
window.setInterval(checkReminders, 30000);

document.querySelector('#edit-goal').addEventListener('click', () => {
  document.querySelector('#goal-input').value = settings.goal || 'Stå opp omtrent samme tid hver dag.';
  document.querySelector('#goal-dialog').showModal();
  document.querySelector('#goal-input').focus();
});
document.querySelectorAll('[data-close-goal]').forEach((button) => button.addEventListener('click', () => document.querySelector('#goal-dialog').close()));
document.querySelector('#goal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const updated = document.querySelector('#goal-input').value.trim();
  if (!updated) {
    showToast('Målet kan ikke være tomt.');
    return;
  }
  const previousGoal = settings.goal;
  settings.goal = updated;
  if (!saveSettings()) {
    if (previousGoal === undefined) delete settings.goal;
    else settings.goal = previousGoal;
    return;
  }
  document.querySelector('#goal-text').textContent = settings.goal;
  document.querySelector('#goal-dialog').close();
  showToast('Målet ditt er oppdatert.');
});

function exportCsv() {
  const headers = ['Dato', 'Behandlingsprofil', 'La meg', 'Lys av', 'Sovnet', 'Oppvåkninger', 'Våken tid (min)', 'Siste oppvåkning', 'Sto opp', 'Søvn (min)', 'Søvneffektivitet (%)', 'Søvnkvalitet', 'Energi', 'Sovemedisin', 'Alkohol (enheter)', 'Koffein (mg)', 'Dagsøvn (min)', 'Lysbehandling (min)', 'Melatonin (mg)', 'Melatonin tidspunkt', 'Hendelseslogg'];
  const rows = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((entry) => [
    entry.date, Array.isArray(entry.treatment) ? entry.treatment.map((item) => treatmentNames[item]).filter(Boolean).join(' og ') : '',
    entry.bedtime, entry.lightsOut, entry.sleepOnset, entry.awakenings, entry.awakeMinutes,
    entry.finalWake, entry.riseTime, getSleepMinutes(entry) ?? '', getEfficiency(entry) ?? '',
    entry.quality, entry.energy, entry.medication, entry.alcohol, entry.caffeine, entry.nap, entry.light,
    entry.melatonin, entry.melatoninTime, formatNightEvents(entry.events),
  ]);
  const csv = [headers, ...rows].map((row) => row.map((field) => `"${String(field ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sov-godt-sovndagbok-${dateKey(today)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Søvndagboken er lastet ned som CSV.');
}

function exportPdfReport() {
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    showToast('Tillat popup-vinduer for å lage rapporten.');
    return;
  }
  const records = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  const summaries = [7, 14, 30].map((days) => {
    const subset = getEntries(days);
    return `<div><span>Siste ${days} dager</span><strong>${formatDuration(average(subset.map(getSleepMinutes)))}</strong><small>Gj.snittlig søvneffektivitet: ${average(subset.map(getEfficiency)) === null ? '–' : `${Math.round(average(subset.map(getEfficiency)))} %`}</small></div>`;
  }).join('');
  const tableRows = records.map((entry) => `<tr>
    <td>${escapeHtml(shortDate(entry.date))}</td><td>${escapeHtml(Array.isArray(entry.treatment) ? entry.treatment.map((item) => treatmentNames[item]).filter(Boolean).join(' og ') : '')}</td><td>${escapeHtml(entry.bedtime)}</td><td>${escapeHtml(entry.lightsOut)}</td>
    <td>${escapeHtml(entry.sleepOnset)}</td><td>${escapeHtml(entry.awakenings)}</td><td>${escapeHtml(entry.awakeMinutes)} min</td>
    <td>${escapeHtml(entry.finalWake)}</td><td>${escapeHtml(entry.riseTime)}</td><td>${escapeHtml(formatDuration(getSleepMinutes(entry)))}</td>
    <td>${getEfficiency(entry) ?? '–'}${getEfficiency(entry) === null ? '' : ' %'}</td><td>${escapeHtml(entry.quality || '–')} / 5</td>
    <td>${escapeHtml(entry.energy || '–')} / 5</td><td>${escapeHtml(entry.medication || '–')}</td><td>${escapeHtml(entry.alcohol)}</td>
    <td>${escapeHtml(entry.caffeine)} mg</td><td>${escapeHtml(entry.nap)} min</td><td>${escapeHtml(entry.light)} min</td><td>${escapeHtml(entry.melatonin)} mg ${escapeHtml(entry.melatoninTime || '')}</td><td>${escapeHtml(formatNightEvents(entry.events))}</td>
  </tr>`).join('');
  const report = `<!doctype html><html lang="no"><head><meta charset="utf-8"><title>Søvndagbok – Sov godt</title>
    <style>
      *{box-sizing:border-box}body{color:#24334c;font:11px/1.45 Arial,sans-serif;margin:26px}
      h1{font-size:23px;margin:0 0 5px}h2{font-size:14px;margin:22px 0 9px}
      .muted{color:#65748b}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
      .summary div{border:1px solid #dfe5ef;border-radius:8px;padding:11px}.summary span,.summary small{color:#65748b;display:block}
      .summary strong{display:block;font-size:17px;margin:4px 0}.notice{background:#f1f3fa;border-radius:7px;margin:15px 0;padding:10px}
      table{border-collapse:collapse;font-size:8px;width:100%}th,td{border-bottom:1px solid #e5e9f0;padding:6px 4px;text-align:left;white-space:nowrap}
      th{background:#f4f6fa;color:#4f5f78}footer{color:#65748b;font-size:9px;margin-top:18px}
      @page{size:landscape;margin:12mm}@media print{body{margin:0}}
    </style></head><body>
    <h1>Søvndagbok – Sov godt</h1><p class="muted">${isDemoData ? 'Demonstrasjonsrapport – fiktive eksempeldata' : 'Behandlingsrapport'} · Generert ${escapeHtml(today.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }))} · ${records.length} netter registrert</p>
    <div class="summary">${summaries}</div>
    <p class="notice">Rapporten oppsummerer egenregistrerte opplysninger og er ikke en medisinsk vurdering eller diagnose. Søvneffektivitet er beregnet som estimert søvntid delt på tid fra lys av til oppståtid.</p>
    <h2>Dagbokregistreringer</h2>
    <table><thead><tr><th>Dato</th><th>Behandling</th><th>La meg</th><th>Lys av</th><th>Sovnet</th><th>Oppvåkninger</th><th>Våken tid</th><th>Siste oppvåkning</th><th>Sto opp</th><th>Søvn</th><th>Eff.</th><th>Kvalitet</th><th>Energi</th><th>Sovemedisin</th><th>Alkohol</th><th>Koffein</th><th>Dagsøvn</th><th>Lys</th><th>Melatonin</th><th>Hendelser</th></tr></thead><tbody>${tableRows}</tbody></table>
    <footer>Ta rapporten med til behandleren din. Endringer i søvnvindu, lysbehandling eller melatonin skal avtales med helsepersonell.</footer>
    <script>window.addEventListener('load',()=>{window.focus();window.print()})<\/script></body></html>`;
  reportWindow.document.open();
  reportWindow.document.write(report);
  reportWindow.document.close();
}

document.querySelector('#export-report').addEventListener('click', exportPdfReport);
document.querySelector('#export-csv').addEventListener('click', exportCsv);
if (settings.goal) {
  document.querySelector('#goal-text').textContent = settings.goal;
}
renderDashboard();
applyClockFormat();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Kunne ikke registrere frakoblet støtte.', error);
    });
  });
}
