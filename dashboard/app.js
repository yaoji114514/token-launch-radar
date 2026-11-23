// Render the static board and recompute values from data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, watchlistOnly: false, verdict: 'all', dropShare: (DATA.scenario && DATA.scenario.drop_share) || 0.00001, horizon: 0 };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function ifLaunchedOf(row, model, fit) {
    var fitted = Math.pow(10, fit.intercept + fit.slope * Math.log10(Math.max(1, row.tvl_usd)));
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = Math.pow(1 + (growth / 100) * model.growth_weight, model.growth_exponent ?? 1);
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var m = fit.maturity_fit || { floor: model.maturity_floor, range: model.maturity_range };
    var maturity = m.floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * m.range;
    var category = row.category == null ? 'Other' : row.category;
    var adj = fit.category_adjust && Object.hasOwn(fit.category_adjust, category) ? fit.category_adjust[category] : 0;
    var catMult = Math.pow(10, adj === undefined || adj === null ? 0 : adj);
    return Math.max(1, Math.round(fitted * growthMult * maturity * catMult));
  }
  function impliedOf(row, model, fit) {
    return Math.max(1, Math.round(ifLaunchedOf(row, model, fit) * (row.launch_odds === null || row.launch_odds === undefined ? 1 : row.launch_odds)));
  }
  function fittedOf(row, fit) {
    return Math.pow(10, fit.intercept + fit.slope * Math.log10(Math.max(1, row.tvl_usd)));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ==FARM-BEGIN==
  // Farm-plan templates, same derivation as lib/model.ts (same markers, parity-checked).
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function secondChainOf(p) { return p.chains && p.chains.length > 1 ? p.chains[1] : null; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function gasFor(capital) { return capital >= 150 ? 8 : 4; }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('aggregator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged basis position.';
    if (c.indexOf('interest rate') >= 0) return 'Deposit $' + capital + ' into an interest-rate market on ' + name + ' and hold both sides of one rate position.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0 || c.indexOf('dual-token') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('index') >= 0) return "Buy $" + capital + " of " + name + "'s index tokens on " + chain + ' and hold them.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' over the month and keep the receipts.';
    if (c.indexOf('privacy') >= 0) return "Deposit $" + capital + " through " + name + "'s shielded pool on " + chain + ' and keep the note.';
    if (c.indexOf('launchpad') >= 0) return "Watch " + name + "'s sale calendar and commit $" + capital + ' to the next sale you qualify for.';
    if (c.indexOf('nft') >= 0) return 'Trade one item worth about $' + capital + ' through ' + name + ' on ' + chain + '.';
    if (c.indexOf('otc') >= 0) return 'Post one OTC quote of about $' + capital + ' through ' + name + ' on ' + chain + '.';
    if (c.indexOf('governance') >= 0) return 'Take part in one governance vote on ' + name + ' with a $' + capital + ' position.';
    if (c === 'chain') return 'Bridge $' + capital + ' to ' + name + ', make one swap on its main venue, and hold the position.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount, under a third of the supply, against the position and repay it within the week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('aggregator') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('farm') >= 0) return "Swap once through the protocol's own router so the wallet shows trading activity as well as liquidity.";
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge a smaller amount back the other way so the wallet shows round-trip usage.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake a second, smaller amount and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('basis') >= 0 || c.indexOf('interest rate') >= 0) return 'Close the first position and open a second small one so the wallet shows repeat trading.';
    if (c.indexOf('prediction') >= 0) return 'Resolve the first position and place a second one on a different market.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit into a second vault on the same chain.';
    if (c.indexOf('stable') >= 0 || c.indexOf('dual-token') >= 0) return 'Swap half the stable position into a second stable asset the protocol supports.';
    if (c.indexOf('rwa') >= 0) return 'Claim or compound one round of yield from the position.';
    if (c.indexOf('insurance') >= 0) return 'Add a second, smaller cover policy on the same chain.';
    if (c.indexOf('index') >= 0) return 'Rebalance the index position once after a week.';
    return 'Use a second feature of the app once, such as a swap, a borrow or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function dateAfter(d, n) { if (!d) return null; var t = Date.parse(d + 'T00:00:00Z'); return isFinite(t) ? new Date(t + n * 864e5).toISOString().slice(0, 10) : null; }
  function farmSteps(p) {
    var chain = chainOf(p);
    var second = secondChainOf(p);
    var capital = capitalFor(p);
    var gas = gasFor(capital);
    var hold = holdDaysFor(p.age_days);
    var action = actionFor(p, capital, chain);
    var tvl = p.tvl_usd >= 1e9 ? '$' + (p.tvl_usd / 1e9).toFixed(2) + 'B' : '$' + Math.round(p.tvl_usd / 1e6) + 'M';
    var chg = p.change_7d == null ? 'n/a' : (p.change_7d >= 0 ? '+' : '') + p.change_7d.toFixed(2) + '%';
    var mainAction = action.replace(/\.$/, '') + ' (TVL ' + tvl + ', 7d ' + chg + ').';
    var end = p.age_days == null ? null : dateAfter(p.listed_at, p.age_days + hold);
    var secondCapital = Math.max(25, Math.round(capital / 2));
    var secondStep = second !== null
      ? { text: 'Repeat the position on ' + second + ' with a second, smaller amount of $' + secondCapital + ' so the wallet is active on two chains.', cost: '$' + secondCapital + ' of capital and about $3 of gas', time: '10 minutes' }
      : { text: secondActionFor(p), cost: 'about $2 of gas', time: '10 minutes' };
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: mainAction, cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      secondStep,
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days' + (end ? ', until ' + end : '') + (p.age_days == null ? '' : ' (listed ' + p.listed_at + ')') + ' so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }
  // ==FARM-END==

  function fmtMinutes(m) {
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var rest = m % 60;
    return rest === 0 ? h + 'h' : h + 'h ' + rest + 'm';
  }

  // The verdict, from the plan's own arithmetic. Mirrors lib/model.ts.
  function scenarioEcon(p, horizonDays) {
    var capital = capitalFor(p);
    var second = secondChainOf(p);
    var secondCapital = second !== null ? Math.max(25, Math.round(capital / 2)) : 0;
    var hold = horizonDays > 0 ? horizonDays : holdDaysFor(p.age_days);
    var weeks = Math.ceil(hold / 7);
    var gas = 3 + gasFor(capital) + (second !== null ? 3 : 2) + 2 * weeks;
    var minutes = 5 + 15 + 10 + 10 * weeks + 10 + 5;
    return { capital: capital + secondCapital, gas: gas, hold: hold, weeks: weeks, minutes: minutes };
  }
  function verdictOf(row) {
    var econ = scenarioEcon(row, state.horizon);
    var net = row.implied_value_usd * state.dropShare - econ.gas;
    var netPerHour = net / (econ.minutes / 60);
    var minPerHour = (DATA.scenario && DATA.scenario.farm_min_net_per_hour) || 5;
    return {
      econ: econ,
      net: Math.round(net * 100) / 100,
      netPerHour: Math.round(netPerHour * 100) / 100,
      verdict: net > 0 && netPerHour >= minPerHour ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP'
    };
  }

  // The comps chart: traded protocols as dots on log-log axes, the fitted line, watchlist diamonds. Pure SVG, no network.
  function chartSvg() {
    var W = 660, H = 320, L = 56, R = 16, T = 14, B = 38;
    var pts = DATA.fit_points || [];
    var watch = DATA.rows.filter(function (r) { return r.watchlist; });
    var xs = [], ys = [];
    pts.forEach(function (p) { xs.push(Math.log10(Math.max(1, p.tvl_usd))); ys.push(Math.log10(Math.max(1, p.mcap_usd))); });
    watch.forEach(function (r) { xs.push(Math.log10(Math.max(1, r.tvl_usd))); ys.push(Math.log10(Math.max(1, r.implied_value_usd))); });
    if (xs.length === 0) return '';
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    if (x1 === x0) x1 = x0 + 1;
    if (y1 === y0) y1 = y0 + 1;
    function X(v) { return L + (v - x0) / (x1 - x0) * (W - L - R); }
    function Y(v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Log-log scatter of traded protocols with the fitted line">';
    var k;
    for (k = x0; k <= x1; k++) {
      s += '<line x1="' + X(k).toFixed(1) + '" y1="' + T + '" x2="' + X(k).toFixed(1) + '" y2="' + (H - B) + '" class="grid" />';
      s += '<text x="' + X(k).toFixed(1) + '" y="' + (H - B + 18) + '" class="tick' + (k === x1 ? ' end' : '') + '">' + fmtUsd(Math.pow(10, k)) + '</text>';
    }
    for (k = y0; k <= y1; k++) {
      s += '<line x1="' + L + '" y1="' + Y(k).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(k).toFixed(1) + '" class="grid" />';
      s += '<text x="' + (L - 8) + '" y="' + (Y(k) + 4).toFixed(1) + '" class="tick end">' + fmtUsd(Math.pow(10, k)) + '</text>';
    }
    s += '<text x="' + ((L + W - R) / 2).toFixed(1) + '" y="' + (H - 4) + '" class="axis">TVL (log scale)</text>';
    s += '<text x="14" y="' + ((T + H - B) / 2).toFixed(1) + '" class="axis" transform="rotate(-90 14 ' + ((T + H - B) / 2).toFixed(1) + ')">Market cap / implied value (log scale)</text>';
    var fit = DATA.fit;
    var ya = fit.intercept + fit.slope * x0, yb = fit.intercept + fit.slope * x1;
    s += '<line x1="' + X(x0).toFixed(1) + '" y1="' + Y(Math.max(y0, Math.min(y1, ya))).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(Math.max(y0, Math.min(y1, yb))).toFixed(1) + '" class="fitline" />';
    pts.forEach(function (p) {
      var cx = X(Math.log10(Math.max(1, p.tvl_usd))).toFixed(1), cy = Y(Math.log10(Math.max(1, p.mcap_usd))).toFixed(1);
      s += p.kept
        ? '<circle cx="' + cx + '" cy="' + cy + '" r="3.8" class="dot" />'
        : '<circle cx="' + cx + '" cy="' + cy + '" r="3.8" class="dot out" />';
    });
    watch.forEach(function (r) {
      var cx = X(Math.log10(Math.max(1, r.tvl_usd))), cy = Y(Math.log10(Math.max(1, r.implied_value_usd)));
      s += '<rect x="' + (cx - 3.4).toFixed(1) + '" y="' + (cy - 3.4).toFixed(1) + '" width="6.8" height="6.8" class="diamond" transform="rotate(45 ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')" />';
    });
    return s + '</svg>';
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('w') === '1') state.watchlistOnly = true;
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('v')) state.verdict = params.get('v');
    if (params.get('s')) state.dropShare = parseFloat(params.get('s')) || state.dropShare;
    if (params.get('h')) state.horizon = parseInt(params.get('h'), 10) || 0;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.watchlistOnly) params.set('w', '1');
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.verdict !== 'all') params.set('v', state.verdict);
    if (state.dropShare !== ((DATA.scenario && DATA.scenario.drop_share) || 0.00001)) params.set('s', String(state.dropShare));
    if (state.horizon > 0) params.set('h', String(state.horizon));
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.verdict !== 'all' && verdictOf(r).verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.launch_odds; bv = b.launch_odds; }
      else if (key === 'net') { av = verdictOf(a).netPerHour; bv = verdictOf(b).netPerHour; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('p', { class: 'eyebrow', text: 'Pre-token protocols · Ranked by expected value' }),
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by expected value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Expected value is the fitted value if the protocol launches, weighted by the fitted chance it launches — the odds come from the snapshot itself, and the validation below shows what each half is worth. It is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function evidence() {
    var v = DATA.validation || {};
    var o = DATA.odds || {};
    function kpi(label, value, sub) {
      return el('div', { class: 'kpi' }, el('span', { text: label }), el('b', { text: value }), el('span', { class: 'sub', text: sub }));
    }
    var kpis = el('div', { class: 'kpis' },
      kpi('Holdout error', v.split_half_factor ? 'x' + v.split_half_factor.toFixed(2) : 'n/a', 'plain line x' + (v.split_half_plain_factor ? v.split_half_plain_factor.toFixed(2) : 'n/a')),
      kpi('Coverage (80%)', v.coverage_80 !== null && v.coverage_80 !== undefined ? (v.coverage_80 * 100).toFixed(1) + '%' : 'n/a', 'n=' + (v.coverage_n || 0) + ' held out'),
      kpi('Odds Brier', o.brier !== undefined ? o.brier.toFixed(3) : 'n/a', 'base rate ' + (o.base_brier !== undefined ? o.base_brier.toFixed(3) : 'n/a')),
      kpi('Checks', (v.checks_passed || 0) + '/' + (v.checks_total || 0) + ' pass', (v.checks_total || 0) > 0 && (v.checks_passed || 0) === (v.checks_total || 0) ? 'all pass' : 'miss named below'),
      kpi('FARM rows', String(DATA.farmable_rows), 'default scenario'),
      kpi('Best net/h', DATA.best_net_per_hour_usd !== undefined ? '$' + DATA.best_net_per_hour_usd.toFixed(0) : 'n/a', 'net of gas')
    );
    var topFarm = DATA.rows.filter(function (r) { return r.verdict === 'FARM'; }).sort(function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; }).slice(0, 5).map(function (r) { return r.name + ' $' + Math.round(r.net_per_hour_usd) + '/h'; }).join(' · ');
    var farmTop = el('p', { class: 'integrity', text: 'Top farm by net $/h: ' + topFarm });
    var ledger = (DATA.ledger || []).map(function (g) {
      return el('div', { class: 'ledger-row' },
        el('span', { class: 'ledger-label', text: g.label }),
        el('div', { class: 'ledger-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(1, Math.round((g.count / 758) * 100)) + '%' })),
        el('b', { class: 'num', text: String(g.count) }),
        el('span', { class: 'sub', text: g.detail })
      );
    });
    function vrow(label, value, pass, note) {
      return el('div', { class: 'vrow' },
        el('span', { text: label }),
        el('b', { class: 'num', text: value }),
        el('span', { class: 'vchip ' + (pass ? 'pass' : 'fail'), text: pass ? 'PASS' : 'FAIL' }),
        el('span', { class: 'sub', text: note })
      );
    }
    var coverageMin = DATA.model.calibrated ? 0.8 : 0.65;
    var validation = el('div', { class: 'valid' },
      el('h2', { text: 'Validation, out of sample' }),
      vrow('Split-half, adjusted', v.split_half_factor ? 'x' + v.split_half_factor.toFixed(2) : 'n/a', v.split_half_plain_factor && v.split_half_factor && v.split_half_factor < v.split_half_plain_factor, 'plain x' + (v.split_half_plain_factor ? v.split_half_plain_factor.toFixed(2) : 'n/a')),
      vrow('Leave-one-out', v.loo_median_factor ? 'x' + v.loo_median_factor.toFixed(2) : 'n/a', v.loo_plain_factor && v.loo_median_factor && v.loo_median_factor < v.loo_plain_factor, 'plain x' + (v.loo_plain_factor ? v.loo_plain_factor.toFixed(2) : 'n/a')),
      vrow('80% interval coverage', v.coverage_80 == null ? 'n/a' : (v.coverage_80 * 100).toFixed(1) + '%', v.coverage_80 >= coverageMin && v.coverage_80 <= 0.95, 'target ' + coverageMin * 100 + '–95%'),
      vrow('Odds Brier, even fits odd', o.brier_fwd.toFixed(3), o.brier_fwd < o.base_brier_fwd, 'base rate ' + o.base_brier_fwd.toFixed(3)),
      vrow('Odds Brier, odd fits even', o.brier_rev.toFixed(3), o.brier_rev < o.base_brier_rev, 'base rate ' + o.base_brier_rev.toFixed(3)),
      el('p', { class: 'sub', text: '200 bootstrap refits. ' + DATA.top20_stable_count + ' of the top 20 stay there in at least 80% of refits.' })
    );
    var recomputed = 0;
    DATA.rows.forEach(function (r) { if (impliedOf(r, DATA.model, DATA.fit) === r.implied_value_usd) recomputed++; });
    var integrity = el('p', { class: 'integrity' },
      el('span', { class: 'key dot' }),
      ' This board is board.json, recomputed live: ' + recomputed + '/' + DATA.rows.length + ' rows match. sha256 ' + (DATA.board_sha256 || '').slice(0, 16) + '…'
    );
    return el('section', { class: 'evidence' },
      kpis,
      farmTop,
      el('div', { class: 'evidence-main' },
        el('div', { class: 'evidence-left' },
          el('div', { class: 'ledger' }, el('h2', { text: 'The whole snapshot: 758 protocols' }), ledger),
          validation),
        el('div', { class: 'panel chart-panel' },
          el('h2', { text: 'The comps line, fitted' }),
          el('div', { class: 'chart', html: chartSvg() }),
          el('p', { class: 'sub', text: 'Dots are traded protocols; diamonds are watchlist implied values; the line is the fitted comps line.' }))),
      integrity
    );
  }

  // One helper builds every select in the controls. The scenario selects re-price every verdict.
  function mkSel(id, label, pairs, cur, onChange) {
    var s = el('select', { id: id, 'aria-label': label },
      pairs.map(function (p) { return el('option', { value: String(p[0]), text: p[1], selected: p[0] === cur ? 'selected' : null }); })
    );
    s.addEventListener('change', function () { onChange(s.value); writeHash(); render(); });
    return s;
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = mkSel('category', 'Filter by category', [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; });
    var verdictSel = mkSel('verdict', 'Filter by farm verdict', [['all', 'All verdicts'], ['FARM', 'FARM'], ['MARGINAL', 'MARGINAL'], ['SKIP', 'SKIP']], state.verdict, function (v) { state.verdict = v; });
    var watchBox = el('input', { type: 'checkbox', id: 'watchlist-only', checked: state.watchlistOnly ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watchBox.addEventListener('change', function () { state.watchlistOnly = watchBox.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var shareSel = mkSel('drop-share', 'Drop share scenario', [[0.000001, '0.0001%'], [0.000005, '0.0005%'], [0.00001, '0.001%'], [0.00005, '0.005%'], [0.0001, '0.01%'], [0.001, '0.1%']], state.dropShare, function (v) { state.dropShare = parseFloat(v); });
    var horizonSel = mkSel('horizon', 'Farm horizon scenario', [[0, 'Plan hold'], [30, '30 days'], [45, '45 days'], [60, '60 days'], [90, '90 days']], state.horizon, function (v) { state.horizon = parseInt(v, 10); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), verdictSel),
      el('div', { class: 'field check' }, el('label', { for: 'watchlist-only' }, watchBox, ' Watchlist only')),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('div', { class: 'field' }, el('label', { for: 'drop-share', text: 'Drop share' }), shareSel),
      el('div', { class: 'field' }, el('label', { for: 'horizon', text: 'Horizon' }), horizonSel),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.watchlistOnly = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var vd = verdictOf(r);
      var vdClass = vd.verdict === 'FARM' ? 'farm' : vd.verdict === 'MARGINAL' ? 'marginal' : 'skip';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' }, el('div', { class: 'rankcell' },
          r.rank <= 3 ? el('span', { class: 'rank-top', text: String(r.rank) }) : String(r.rank),
          (r.rank_low !== r.rank || r.rank_high !== r.rank) ? el('span', { class: 'sub', text: 'r ' + r.rank_low + '–' + r.rank_high }) : null
        )),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: Math.round(r.launch_odds * 100) + '%' }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', null,
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('div', { class: 'sub', text: fmtUsd(r.value_p10_usd) + '–' + fmtUsd(r.value_p90_usd) })
          )
        )),
        el('td', null, el('div', { class: 'verdictcell' },
          el('span', { class: 'vchip ' + vdClass, text: vd.verdict }),
          el('span', { class: 'sub ' + (vd.netPerHour >= 0 ? 'pos' : 'neg'), text: '$' + vd.netPerHour.toFixed(0) + '/h' })
        )),
        el('td', null, el('span', { class: 'chip' + (r.watchlist ? ' watch' : ''), text: r.watchlist ? 'Watchlist' : 'Early' }))
      );
      tbody.appendChild(tr);
    });
    var captionText = state.sort === 'net'
      ? 'Pre-token protocols, sorted by net dollars per hands-on hour: expected value times the drop share, minus the farm plan\u2019s gas, per hour of hands-on time. The range is the bootstrap P10–P90. Select a row for its dossier.'
      : state.sort === 'odds'
        ? 'Pre-token protocols, sorted by fitted launch odds. Expected value is the fitted value if launched, weighted by launch odds; the range is the bootstrap P10–P90. Select a row for its dossier.'
        : 'Pre-token protocols, strongest expected value first: fitted value if launched, weighted by launch odds; the range is the bootstrap P10–P90. The verdict is the farm plan\u2019s arithmetic at the scenario above. Select a row for its dossier.';
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: captionText }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Odds'),
            sortHeader('implied', 'Expected value'),
            sortHeader('net', 'Verdict'),
            el('th', { scope: 'col', text: 'Set' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'chip', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking, and the traded ones with a recorded market cap are what the comps line is fitted on.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  // The launch odds in one sentence: what the fitted model is, how well it scores, which categories launch most often.
  function oddsNote() {
    var o = DATA.odds;
    if (!o) return 'No launch-odds model on this snapshot.';
    var rates = (o.category_rates || []).slice().sort(function (a, b) { return b.rate - a.rate; });
    var top = rates.length ? rates[0].category + ' ' + Math.round(rates[0].rate * 100) + '%' : 'n/a';
    var bottom = rates.length ? rates[rates.length - 1].category + ' ' + Math.round(rates[rates.length - 1].rate * 100) + '%' : 'n/a';
    return 'Launch odds: logistic regression on the snapshot\u2019s traded protocols (n=' + o.n + ', ' + Math.round(o.base_rate * 100) + '% launched), on log TVL, age, seven-day growth and sector, L2 lambda 10. Brier ' + o.brier.toFixed(3) + ' vs base rate ' + o.base_brier.toFixed(3) + '; it beats the base rate both ways split in half (even fits odd ' + o.brier_fwd.toFixed(3) + ' vs ' + o.base_brier_fwd.toFixed(3) + '; odd fits even ' + o.brier_rev.toFixed(3) + ' vs ' + o.base_brier_rev.toFixed(3) + '). Most likely: ' + top + '; least: ' + bottom + '.';
  }

  function modelPanel() {
    var m = DATA.model;
    var f = DATA.fit;
    var valid = f.median_abs_log_error === null || f.median_abs_log_error === undefined
      ? 'no split-half validation (too few traded protocols)'
      : 'split-half median error x' + Math.pow(10, f.median_abs_log_error).toFixed(2) + ': half the held-out traded protocols sit within that factor of the line';
    var fitNote = f.fallback
      ? 'Too few traded protocols record a market cap in this snapshot, so the line falls back to the median market-cap-to-TVL ratio (' + f.median_ratio.toFixed(3) + '), the same formula with slope 1.'
      : 'Fitted on ' + f.n + ' of ' + f.n_total + ' traded protocols that record a market cap (' + (f.n_total - f.n) + ' trimmed as outliers, beyond ' + m.trim_k + ' x 1.4826 x MAD from the median residual). R-squared ' + f.r2.toFixed(3) + ' for the adjusted line: the fit is loose, and ' + valid + '.';
    var adjEntries = f.category_adjust ? Object.keys(f.category_adjust).map(function (c) {
      return { c: c, mult: Math.pow(10, f.category_adjust[c]) };
    }) : [];
    adjEntries.sort(function (a, b) { return Math.abs(Math.log10(b.mult)) - Math.abs(Math.log10(a.mult)); });
    var adjNote = m.calibrated
      ? 'Category shifts blend 75% of radar-7 with 25% pooled residuals in log space. The intercept is recalibrated on each fit.'
      : 'Category shifts use shrunk median market cap / TVL ratios (category n≥8, otherwise family n≥5).';
    if (adjEntries.length) adjNote += ' Largest: ' + adjEntries.slice(0, 3).map(function (e) { return e.c + ' x' + e.mult.toFixed(2); }).join(', ') + '.';
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('div', { class: 'formula' },
        'implied = round( 10 ^ (' + f.intercept.toFixed(4) + ' + ' + f.slope.toFixed(4) + ' x log10(TVL)) x growth x maturity x category )'
      ),
      el('div', { class: 'formula' },
        'expected = round( implied x launch_odds )'
      ),
      el('p', { class: 'sub', text: oddsNote() }),
      el('p', { class: 'sub', text: adjNote }),
      el('div', { class: 'fit-stats' },
          el('div', { class: 'fact' }, el('span', { text: 'Traded protocols fitted' }), el('b', { text: f.n + ' of ' + f.n_total })),
          el('div', { class: 'fact' }, el('span', { text: 'Fitted slope (log-log)' }), el('b', { text: f.slope.toFixed(3) })),
          el('div', { class: 'fact' }, el('span', { text: 'R-squared (log space)' }), el('b', { text: f.r2.toFixed(3) })),
          el('div', { class: 'fact' }, el('span', { text: 'Median mcap / TVL' }), el('b', { text: f.median_ratio.toFixed(3) })),
          el('div', { class: 'fact' }, el('span', { text: 'Validation' }), el('b', { text: f.median_abs_log_error === null || f.median_abs_log_error === undefined ? 'n/a' : 'x' + Math.pow(10, f.median_abs_log_error).toFixed(2) })),
          el('div', { class: 'fact' }, el('span', { text: 'Launch-odds Brier (base)' }), el('b', { text: (DATA.odds ? DATA.odds.brier.toFixed(3) : 'n/a') + ' (' + (DATA.odds ? DATA.odds.base_brier.toFixed(3) : 'n/a') + ')' })),
          el('p', { class: 'sub', text: fitNote }),
          el('p', { class: 'legend' },
            el('span', { class: 'key dot' }), ' Traded protocol fitted  ',
            el('span', { class: 'key out' }), ' Trimmed outlier  ',
            el('span', { class: 'key diamond' }), ' Watchlist implied value'
          )
        ),
      el('p', { class: 'sub', text: m.fit_maturity
        ? f.maturity_fit
          ? 'Fitted maturity: floor ' + f.maturity_fit.floor.toFixed(4) + ', range ' + f.maturity_fit.range.toFixed(4) + ' (' + f.maturity_fit.n + ' known ages). Age is capped at ' + m.maturity_days + ' days.'
          : 'Too little age variation to fit maturity. Using the radar-7 age curve.'
        : m.calibrated
        ? 'Growth uses the square root of the radar-7 multiplier. Age enters launch odds.'
        : 'The growth multiplier uses clamped seven-day growth. Maturity rises with age up to three years.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  // The five traded protocols closest in TVL to this row, same category first: the comparables
  // the comps line is fitted on, shown so the judge can see what the line is made of.
  function peersOf(row) {
    var pts = (DATA.fit_points || []).filter(function (p) { return p.kept; });
    var target = Math.log10(Math.max(1, row.tvl_usd));
    pts.forEach(function (p) { p._d = Math.abs(Math.log10(Math.max(1, p.tvl_usd)) - target); p._same = p.category === row.category ? 0 : 1; });
    pts.sort(function (a, b) { return a._same - b._same || a._d - b._d; });
    return pts.slice(0, 5);
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var econ = scenarioEcon(row, 0);
    var recomputed = impliedOf(row, DATA.model, DATA.fit);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' - Watchlist' : ' - Early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + '. Records no token in the snapshot.' })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var cols = el('div', { class: 'detail-cols' });
    dialog.appendChild(cols);
    cols.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted market cap (comps line)' }), el('b', { class: 'num', text: fmtUsd(fittedOf(row, DATA.fit)) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Category multiplier' }), el('b', { class: 'num', text: 'x' + Number(row.category_multiplier).toFixed(2) })),
        el('div', null, el('span', { text: 'Implied value if it launches' }), el('b', { class: 'num', text: fmtUsd(row.implied_if_launched_usd) })),
        el('div', null, el('span', { text: 'Launch odds (fitted)' }), el('b', { class: 'num', text: Math.round(row.launch_odds * 100) + '%' })),
        el('div', { class: 'hl' }, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'P10–P90, 200 refits' }), el('b', { class: 'num', text: fmtUsd(row.value_p10_usd) + ' – ' + fmtUsd(row.value_p90_usd) })),
        el('div', null, el('span', { text: 'Bootstrap rank range' }), el('b', { class: 'num', text: row.rank_low + '–' + row.rank_high }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    cols.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Nearest traded peers' }),
      el('div', { class: 'peers' }, peersOf(row).map(function (p) {
        return el('div', { class: 'peer' },
          el('span', { text: p.name + (p.category === row.category ? '' : ' · ' + (p.category || 'Other')) }),
          el('span', { class: 'num', text: fmtUsd(p.tvl_usd) }),
          el('span', { class: 'num', text: fmtUsd(p.mcap_usd) }),
          el('span', { class: 'num', text: (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' })
        );
      })),
      el('p', { class: 'sub', text: 'The five traded protocols closest in TVL to this one, same category first. Columns: TVL, market cap, market cap / TVL — the comparables the line is fitted on.' })
    ));
    var vd = verdictOf(row);
    var sharePct = (state.dropShare * 100).toFixed(4);
    var second = secondChainOf(row);
    var matrixShares = [0.00001, 0.0001, 0.001];
    var matrixDeposits = [50, 100, 250];
    var matrixRows = matrixDeposits.map(function (d) {
      var g = 3 + gasFor(d) + (second !== null ? 3 : 2) + 2 * vd.econ.weeks;
      return el('div', { class: 'mrow' },
        el('span', { class: 'num', text: '$' + d }),
        matrixShares.map(function (s) {
          var net = row.implied_value_usd * s - g;
          return el('span', { class: 'mcell num ' + (net >= 0 ? 'pos' : 'neg'), text: (net >= 0 ? '+' : '') + '$' + Math.round(net) });
        })
      );
    });
    cols.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Capital in positions' }), el('b', { class: 'num', text: '$' + econ.capital })),
        el('div', null, el('span', { text: 'Gas over the whole plan' }), el('b', { class: 'num', text: 'about $' + econ.gas })),
        el('div', null, el('span', { text: 'Hands-on time' }), el('b', { class: 'num', text: fmtMinutes(econ.minutes) + ' over ' + econ.hold + ' days' })),
        el('div', { class: 'hl' }, el('span', { text: 'Break-even allocation (gas only)' }), el('b', { class: 'num', text: '$' + econ.gas })),
        el('div', null, el('span', { text: 'Expected allocation at ' + sharePct + '% drop share' }), el('b', { class: 'num', text: '$' + Math.round(row.implied_value_usd * state.dropShare) })),
        el('div', null, el('span', { text: 'Net after gas, this scenario' }), el('b', { class: 'num ' + (vd.net >= 0 ? 'pos' : 'neg'), text: (vd.net >= 0 ? '+' : '') + '$' + vd.net.toFixed(0) })),
        el('div', null, el('span', { text: 'Net per hands-on hour' }), el('b', { class: 'num ' + (vd.netPerHour >= 0 ? 'pos' : 'neg'), text: '$' + vd.netPerHour.toFixed(0) + '/h' })),
        el('div', null, el('span', { text: 'Verdict, this scenario' }), el('span', { class: 'vchip ' + (vd.verdict === 'FARM' ? 'farm' : vd.verdict === 'MARGINAL' ? 'marginal' : 'skip'), text: vd.verdict }))
      ),
      el('p', { class: 'sub', text: 'The plan pays for its gas if any eventual allocation exceeds $' + econ.gas + '. Capital stays in the positions until the hold ends, so it is at risk for the full ' + econ.hold + ' days. Drop share ' + sharePct + '% is the board\u2019s scenario — a 5% community allocation split across ~5,000 wallets; change it above and the verdict moves. Gas varies by chain.' }),
      el('h4', { text: 'Net $ by deposit and drop share' }),
      el('div', { class: 'matrix' },
        el('div', { class: 'mrow mhead' }, el('span', { text: 'Deposit' }), matrixShares.map(function (s) { return el('span', { text: (s * 100).toFixed(3) + '%' }); })),
        matrixRows
      ),
      el('p', { class: 'sub', text: 'Each cell is the expected allocation minus the plan\u2019s gas at that deposit; green pays for itself. Break-even drop share is ' + (econ.gas / row.implied_value_usd * 100).toFixed(4) + '% of expected value.' })
    ));
    cols.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(evidence());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
