/* Live vêr på framsida: hentar Locationforecast frå api.met.no (Yr/MET) i
 * besøkjendens nettlesar og oppdaterer .weather-now kvart 10. min.
 * Reglar (frå briefen): aldri fabrikkerie tal — ved feil står det
 * serverbygde talet frå now.json att (maks ~30 min gamalt).
 * MET krev identifiserande User-Agent; vi sender Kontakt-linje frå nettsida.
 */
(function () {
  'use strict';
  var panel = document.querySelector('.weather-now');
  if (!panel || !window.fetch) return;

  var LAT = panel.dataset.lat || '69.649';
  var LON = panel.dataset.lon || '18.956';
  var LANG = panel.dataset.lang === 'en' ? 'en' : 'no';

  var URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + LAT + '&lon=' + LON;
  var UA = 'tromsø.net front page (https://xn--troms-zua.net; kontakt: hysinghenrik@gmail.com)';

  function fmtTemp(v) {
    var r = Math.round(v);
    return (LANG === 'no' ? String(r).replace('-', '−') : String(r)) + '°';
  }
  function fmtWind(v) {
    return (LANG === 'no' ? String(v).replace('.', ',') : String(v)) + ' m/s';
  }
  function hm() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date());
  }

  function currentHour(timeseries) {
    // tanken: punktet som gjeld no = siste med time <= no.
    var best = null, nowMs = Date.now();
    for (var i = 0; i < timeseries.length; i++) {
      var ms = Date.parse(timeseries[i].time);
      if (ms <= nowMs && (!best || ms > Date.parse(best.time))) best = timeseries[i];
    }
    return best || timeseries[0];
  }

  function apply(j) {
    var t = currentHour(j.properties.timeseries);
    if (!t) return false;
    var d = t.data || {};
    var next = d.next_1_hours || d.next_6_hours || d.next_12_hours || {};
    var code = (next.summary && next.summary.symbol_code) || null;
    var temp = d.instant && d.instant.details ? d.instant.details.air_temperature : null;
    var wind = d.instant && d.instant.details ? d.instant.details.wind_speed : null;
    var el;
    if (code && (el = panel.querySelector('.weather-icon'))) {
      el.src = '/assets/yr/' + encodeURIComponent(code) + '.svg';
    }
    if (temp != null && (el = panel.querySelector('.weather-temp'))) {
      el.textContent = fmtTemp(temp);
      el.classList.remove('weather-missing');
    }
    if (wind != null && (el = panel.querySelector('.weather-wind'))) {
      el.textContent = (LANG === 'no' ? 'vind ' : 'wind ') + fmtWind(wind);
    }
    if (el = panel.querySelector('.weather-updated')) {
      el.textContent = (LANG === 'no' ? 'oppdatert ' : 'updated ') + hm();
    }
    return true;
  }

  function tick() {
    fetch(URL, { headers: { 'User-Agent': UA } })
      .then(function (r) {
        if (!r.ok) throw new Error('MET ' + r.status);
        return r.json();
      })
      .then(apply)
      .catch(function () { /* feil: serverbygde talet står att */ });
  }

  tick();
  setInterval(tick, 10 * 60 * 1000);
})();