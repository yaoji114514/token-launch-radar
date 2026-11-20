// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a filterable table, the fitted comps model with its chart, and a per-protocol
// detail drawer with the model's own inputs, the farm plan's costed economics and the farm plan.
// No network: every byte it shows is in data.js. The page recomputes every implied value from the
// snapshot figures with the same arithmetic main.ts runs, so the page and board.json agree.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, watchlistOnly: false };

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
  // The model in one function: the fitted comps line, then the growth, maturity and category
  // adjustments. The page recomputes a row from the snapshot figures and checks the number
  // board.json carries.
  function impliedOf(row, model, fit) {
    var fitted = Math.pow(10, fit.intercept + fit.slope * Math.log10(Math.max(1, row.tvl_usd)));
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var adj = fit.category_adjust ? fit.category_adjust[row.category || 'Other'] : undefined;
    var catMult = Math.pow(10, adj === undefined || adj === null ? 0 : adj);
    return Math.max(1, Math.round(fitted * growthMult * maturity * catMult));
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
  // The farm-plan templates: the same derivation main.ts writes to board.json. Category, chains, TVL
  // and age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  // lib/model.ts carries the same block between the same markers; a parity check compares both.
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
  function farmSteps(p) {
    var chain = chainOf(p);
    var second = secondChainOf(p);
    var capital = capitalFor(p);
    var gas = gasFor(capital);
    var hold = holdDaysFor(p.age_days);
    var secondCapital = Math.max(25, Math.round(capital / 2));
    var secondStep = second !== null
      ? { text: 'Repeat the position on ' + second + ' with a second, smaller amount of $' + secondCapital + ' so the wallet is active on two chains.', cost: '$' + secondCapital + ' of capital and about $3 of gas', time: '10 minutes' }
      : { text: secondActionFor(p), cost: 'about $2 of gas', time: '10 minutes' };
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      secondStep,
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }
  // ==FARM-END==

  // The plan's costed economics, from the same helpers as the steps: capital, gas, time, and the
  // allocation that would pay for the gas alone. Estimates from the plan's own steps, nothing else.
  function farmEconomics(p) {
    var capital = capitalFor(p);
    var second = secondChainOf(p);
    var secondCapital = second !== null ? Math.max(25, Math.round(capital / 2)) : 0;
    var hold = holdDaysFor(p.age_days);
    var weeks = Math.ceil(hold / 7);
    var gas = 3 + gasFor(capital) + (second !== null ? 3 : 2) + 2 * weeks;
    var minutes = 5 + 15 + 10 + 10 * weeks + 10 + 5;
    return { capital: capital + secondCapital, gas: gas, hold: hold, weeks: weeks, minutes: minutes };
  }
  function fmtMinutes(m) {
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var rest = m % 60;
    return rest === 0 ? h + 'h' : h + 'h ' + rest + 'm';
  }

  // The comps chart: traded protocols as dots on log-log axes, the fitted line through them, and the
  // watchlist's implied values as diamonds. Pure SVG, built from DATA, no network.
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
      s += '<text x="' + X(k).toFixed(1) + '" y="' + (H - B + 18) + '" class="tick">' + fmtUsd(Math.pow(10, k)) + '</text>';
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
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.watchlistOnly) params.set('w', '1');
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
        el('p', { class: 'eyebrow', text: 'Pre-token protocols · Ranked by implied value' }),
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is fitted from the traded protocols in this same snapshot, then adjusted for seven-day growth and age with no token. It is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watchlist-only', checked: state.watchlistOnly ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watchBox.addEventListener('change', function () { state.watchlistOnly = watchBox.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field check' }, el('label', { for: 'watchlist-only' }, watchBox, ' Watchlist only')),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
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
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' }, r.rank <= 3 ? el('span', { class: 'rank-top', text: String(r.rank) }) : String(r.rank)),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'chip' + (r.watchlist ? ' watch' : ''), text: r.watchlist ? 'Watchlist' : 'Early' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Every row records no token in the snapshot. Select a row for its model, farm economics and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
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

  function modelPanel() {
    var m = DATA.model;
    var f = DATA.fit;
    var valid = f.median_abs_log_error === null || f.median_abs_log_error === undefined
      ? 'no split-half validation (too few traded protocols)'
      : 'split-half median error x' + Math.pow(10, f.median_abs_log_error).toFixed(2) + ': half the held-out traded protocols sit within that factor of the line';
    var fitNote = f.fallback
      ? 'Too few traded protocols record a market cap in this snapshot, so the line falls back to the median market-cap-to-TVL ratio (' + f.median_ratio.toFixed(3) + '), the same formula with slope 1.'
      : 'Fitted on ' + f.n + ' of ' + f.n_total + ' traded protocols that record a market cap (' + (f.n_total - f.n) + ' trimmed as outliers, beyond ' + m.trim_k + ' x 1.4826 x MAD from the median residual). R-squared ' + f.r2.toFixed(3) + ' in log space for the category-adjusted line: the fit is loose, and ' + valid + '.';
    var adjEntries = f.category_adjust ? Object.keys(f.category_adjust).map(function (c) {
      return { c: c, mult: Math.pow(10, f.category_adjust[c]) };
    }) : [];
    adjEntries.sort(function (a, b) { return Math.abs(Math.log10(b.mult)) - Math.abs(Math.log10(a.mult)); });
    var adjNote = adjEntries.length === 0
      ? 'No category adjusts the fitted value on this snapshot: every category has too few traded protocols to earn one.'
      : 'Category multiplier: ' + adjEntries.length + ' categories adjust the fitted value, each from its own traded protocols (median market-cap-to-TVL against the whole set, shrunk by n/(n+5); fewer than 3 traded protocols earns none). Largest: ' +
        adjEntries.slice(0, 3).map(function (e) { return e.c + ' x' + e.mult.toFixed(2); }).join(', ') + '.';
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( 10 ^ (' + f.intercept.toFixed(4) + ' + ' + f.slope.toFixed(4) + ' x log10(tvl_usd)) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x category_multiplier )'
      ),
      el('p', { class: 'sub', text: adjNote }),
      el('div', { class: 'fit-grid' },
        el('div', { class: 'chart', html: chartSvg() }),
        el('div', { class: 'fit-stats' },
          el('div', { class: 'fact' }, el('span', { text: 'Traded protocols fitted' }), el('b', { text: f.n + ' of ' + f.n_total })),
          el('div', { class: 'fact' }, el('span', { text: 'Fitted slope (log-log)' }), el('b', { text: f.slope.toFixed(3) })),
          el('div', { class: 'fact' }, el('span', { text: 'R-squared (log space)' }), el('b', { text: f.r2.toFixed(3) })),
          el('div', { class: 'fact' }, el('span', { text: 'Median mcap / TVL' }), el('b', { text: f.median_ratio.toFixed(3) })),
          el('div', { class: 'fact' }, el('span', { text: 'Validation' }), el('b', { text: f.median_abs_log_error === null || f.median_abs_log_error === undefined ? 'n/a' : 'x' + Math.pow(10, f.median_abs_log_error).toFixed(2) })),
          el('p', { class: 'sub', text: fitNote }),
          el('p', { class: 'legend' },
            el('span', { class: 'key dot' }), ' Traded protocol fitted  ',
            el('span', { class: 'key out' }), ' Trimmed outlier  ',
            el('span', { class: 'key diamond' }), ' Watchlist implied value'
          )
        )
      ),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Growth is clamped so one hot week cannot dominate the ranking, and maturity rises with age up to three years.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var econ = farmEconomics(row);
    var recomputed = impliedOf(row, DATA.model, DATA.fit);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' - Watchlist' : ' - Early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + '. Records no token in the snapshot.' })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted market cap (comps line)' }), el('b', { class: 'num', text: fmtUsd(fittedOf(row, DATA.fit)) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Category multiplier' }), el('b', { class: 'num', text: 'x' + Number(row.category_multiplier).toFixed(2) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Capital in positions' }), el('b', { class: 'num', text: '$' + econ.capital })),
        el('div', null, el('span', { text: 'Gas over the whole plan' }), el('b', { class: 'num', text: 'about $' + econ.gas })),
        el('div', null, el('span', { text: 'Hands-on time' }), el('b', { class: 'num', text: fmtMinutes(econ.minutes) + ' over ' + econ.hold + ' days' })),
        el('div', { class: 'hl' }, el('span', { text: 'Break-even allocation (gas only)' }), el('b', { class: 'num', text: '$' + econ.gas }))
      ),
      el('p', { class: 'sub', text: 'The plan pays for its gas if any eventual allocation exceeds $' + econ.gas + '. The capital stays in the positions until the hold ends, so it is at risk for the full ' + econ.hold + ' days. Estimates from the steps below; gas varies by chain and congestion.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
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
