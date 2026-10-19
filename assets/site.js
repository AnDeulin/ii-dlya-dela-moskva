/* ИИ для дела: подбор задачи, окно «Написать», копирование, полоса снизу, фильтры.
   Персональные данные не собираются и не хранятся: выбор человека живёт только в адресе страницы. */
(function () {
  "use strict";
  var CFG = window.SITE || {};
  var TG = CFG.tg || "andeulin";
  var MAX_PHONE = CFG.maxPhone || "";
  var MAX_PHONE_VIEW = CFG.maxPhoneView || MAX_PHONE;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function goal(name, params) { try { if (window.ym && CFG.ym) window.ym(CFG.ym, "reachGoal", name, params || {}); } catch (e) {} }

  var toastEl;
  function toast(t) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.classList.add("on");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("on"); }, 2200);
  }
  function copy(text, done) {
    function ok() { toast(done || "Скопировано"); }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(ok, fallback); } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) { toast("Выделите текст и скопируйте вручную"); } document.body.removeChild(ta);
    }
  }

  /* ---------- Окно «Написать» ---------- */
  var bg = $(".sheet-bg"), sheet = $(".sheet"), currentText = "", lastFocus = null;
  function openSheet(text, where) {
    if (!sheet) return;
    currentText = text || CFG.defaultText || "Здравствуйте! Вопрос про курс ИИ для дела.";
    $(".msg", sheet).textContent = currentText;
    $(".js-tg", sheet).href = "https://t.me/" + TG + "?text=" + encodeURIComponent(currentText);
    $(".max-info", sheet).classList.remove("on");
    lastFocus = document.activeElement;
    bg.classList.add("on"); sheet.classList.add("on"); sheet.setAttribute("aria-hidden", "false");
    $(".js-tg", sheet).focus();
    goal("write_open", { where: where || "" });
  }
  function closeSheet() {
    if (!sheet) return;
    bg.classList.remove("on"); sheet.classList.remove("on"); sheet.setAttribute("aria-hidden", "true");
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-write]");
    if (b) { e.preventDefault(); openSheet(b.getAttribute("data-write"), b.getAttribute("data-where")); return; }
    if (e.target.closest(".sheet .x") || e.target === bg) { closeSheet(); return; }
    var c = e.target.closest("[data-copy]");
    if (c) { e.preventDefault(); var src = document.getElementById(c.getAttribute("data-copy")); copy(src ? src.textContent.trim() : c.getAttribute("data-copy-text"), c.getAttribute("data-done")); goal("prompt_copy"); return; }
    var s = e.target.closest("[data-share]");
    if (s) { e.preventDefault(); share(s.getAttribute("data-share") || location.href); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  if (sheet) {
    $(".js-tg", sheet).addEventListener("click", function () { goal("msg_tg"); });
    $(".js-max", sheet).addEventListener("click", function (e) {
      e.preventDefault(); copy(currentText, "Текст скопирован");
      $(".max-info", sheet).classList.add("on"); goal("msg_max");
    });
    var cn = $(".js-copy-phone", sheet);
    if (cn) cn.addEventListener("click", function (e) { e.preventDefault(); copy(MAX_PHONE_VIEW, "Номер скопирован"); });
  }
  function share(url) {
    var u = url.split("#")[0] === location.href.split("#")[0] ? location.href : url;
    goal("share_click");
    if (navigator.share) { navigator.share({ title: document.title, url: u }).catch(function () {}); }
    else { copy(u, "Ссылка скопирована, отправьте её знакомому"); }
  }

  /* ---------- Полоса снизу на телефоне ---------- */
  var dock = $(".dock"), hero = $(".hero, .task-hero");
  if (dock && "IntersectionObserver" in window) {
    var heroGone = false, hide = 0;
    if (hero) new IntersectionObserver(function (en) { heroGone = !en[0].isIntersecting; upd(); }).observe(hero); else heroGone = true;
    var hiders = $$("#price, #final, .sheet");
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { x.target._v = x.isIntersecting; }); hide = hiders.some(function (h) { return h._v; }); upd(); });
    hiders.forEach(function (h) { io.observe(h); });
    function upd() { dock.classList.toggle("on", heroGone && !hide); }
  }

  /* ---------- Подбор задачи ---------- */
  var pk = $(".picker");
  if (pk) initPicker(pk);

  function initPicker(root) {
    var base = root.getAttribute("data-base") || "./";
    var steps = $$(".pk-step", root), res = $(".pk-res", root), bar = $(".pk-bar i", root), cnt = $(".pk-count", root);
    var state = { pains: [], sphere: "" }, data = null, cur = 0;
    var PAIN_TASKS = {
      clients: ["otvety-klientam", "zapis-i-napominaniya", "otvety-na-otzyvy", "vozvrat-klientov"],
      docs: ["scheta-i-akty", "proverka-dogovorov", "kommercheskoe-predlozhenie", "dannye-iz-dokumentov", "pisma-v-nuzhnom-tone"],
      reports: ["svodka-nedeli", "kassovye-razryvy", "razbor-otzyvov", "konkurenty-i-ceny"],
      content: ["posty-i-kontent-plan", "kartochki-tovarov", "sait-bez-programmista", "foto-i-kartinki", "obyavleniya-avito", "reklamnyi-rolik"],
      sales: ["razbor-zayavok", "kalkulyator-stoimosti", "kommercheskoe-predlozhenie", "proverka-zvonkov", "vozvrat-klientov"],
      team: ["protokoly-vstrech", "zadachi-iz-chatov", "reglamenty-dlya-sotrudnikov", "svoi-uchet"],
      unknown: ["otvety-klientam", "svodka-nedeli", "pisma-v-nuzhnom-tone"]
    };
    function load(cb) {
      if (data) return cb();
      fetch(base + "data/tasks.json").then(function (r) { return r.json(); }).then(function (j) { data = j; cb(); })
        .catch(function () { res.innerHTML = '<p>Не получилось загрузить подборку. <a href="' + base + 'zadachi/">Откройте все задачи списком</a>.</p>'; show(2); });
    }
    function show(i) {
      cur = i;
      steps.forEach(function (s, k) { s.classList.toggle("hide", k !== i); });
      res.classList.toggle("on", i === 2);
      if (bar) bar.style.width = ((i + 1) / 3 * 100) + "%";
      if (cnt) cnt.textContent = "Шаг " + (i + 1) + " из 3";
    }
    $$(".opt", steps[0]).forEach(function (o) {
      o.addEventListener("click", function () {
        var v = o.getAttribute("data-v");
        if (v === "unknown") { state.pains = ["unknown"]; $$(".opt", steps[0]).forEach(function (x) { x.setAttribute("aria-pressed", x === o ? "true" : "false"); }); }
        else {
          state.pains = state.pains.filter(function (p) { return p !== "unknown"; });
          var u = $('.opt[data-v="unknown"]', steps[0]); if (u) u.setAttribute("aria-pressed", "false");
          var i = state.pains.indexOf(v);
          if (i < 0) state.pains.push(v); else state.pains.splice(i, 1);
          o.setAttribute("aria-pressed", i < 0 ? "true" : "false");
        }
        $(".js-next", steps[0]).disabled = !state.pains.length;
      });
    });
    $(".js-next", steps[0]).addEventListener("click", function () { if (state.pains.length) { show(1); goal("podbor_step", { step: 2 }); } });
    $$(".opt", steps[1]).forEach(function (o) {
      o.addEventListener("click", function () {
        state.sphere = o.getAttribute("data-v");
        $$(".opt", steps[1]).forEach(function (x) { x.setAttribute("aria-pressed", x === o ? "true" : "false"); });
        load(function () { render(); show(2); writeHash(); goal("podbor_result", { pains: state.pains.join(","), sphere: state.sphere }); res.scrollIntoView({ behavior: "smooth", block: "start" }); });
      });
    });
    $$(".js-back", root).forEach(function (b) { b.addEventListener("click", function () { show(Math.max(0, cur - 1)); }); });
    root.addEventListener("click", function (e) { if (e.target.closest(".js-restart")) { e.preventDefault(); state = { pains: [], sphere: "" }; $$(".opt", root).forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); $(".js-next", steps[0]).disabled = true; history.replaceState(null, "", location.pathname + location.search); show(0); } });

    function pick() {
      var by = {}; data.tasks.forEach(function (t) { by[t.slug] = t; });
      var out = [], seen = {};
      var lists = state.pains.map(function (p) { return (PAIN_TASKS[p] || []).slice(); });
      var sp = state.sphere && state.sphere !== "other" ? state.sphere : "";
      lists = lists.map(function (l) { return l.sort(function (a, b) { return (sp && by[b] && by[b].spheres.indexOf(sp) >= 0 ? 1 : 0) - (sp && by[a] && by[a].spheres.indexOf(sp) >= 0 ? 1 : 0); }); });
      for (var round = 0; out.length < 3 && round < 6; round++) {
        lists.forEach(function (l) { var s = l[round]; if (s && !seen[s] && by[s] && out.length < 3) { seen[s] = 1; out.push(by[s]); } });
      }
      return out;
    }
    function sphereName() { var o = $('.opt[aria-pressed="true"]', steps[1]); return o ? o.textContent.trim() : ""; }
    function render() {
      var list = pick(), sn = sphereName();
      var names = list.map(function (t) { return t.title.toLowerCase(); });
      var code = (CFG.site || "main") + "-" + state.pains.join("+") + "-" + state.sphere;
      var msg = (CFG.writePrefix || "Здравствуйте! Подобрал на сайте ИИ для дела") + ": " + (sn ? sn + ". " : "") + "Задачи: " + names.join("; ") + ". Получится собрать это за 6 встреч? Код " + code;
      var h = "";
      if (state.pains[0] === "unknown") h += '<p class="lead">Это нормально. На второй встрече мы вместе разберём ваше дело и выберем задачу. Вот три задачи, с которых удобно начать:</p>';
      else h += '<p class="lead">Вот что ИИ может взять на себя' + (sn && state.sphere !== "other" ? " в вашей сфере (" + esc(sn.toLowerCase()) + ")" : "") + ". Попробуйте первый шаг сегодня, бесплатно.</p>";
      list.forEach(function (t, i) {
        var ex = t.examples && t.examples[0];
        h += '<article class="res-card"><h3>' + esc(t.title) + '</h3><p class="muted small">' + esc(t.pain) + "</p>" +
          '<div class="layer"><details' + (i === 0 ? " open" : "") + '><summary>СДЕЛАЙТЕ ПЕРВЫЙ ШАГ СЕГОДНЯ</summary><ol>' + t.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
          '<div class="prompt"><span id="pr-' + i + '">' + esc(t.prompt) + '</span><button class="btn btn-line btn-sm copy" data-copy="pr-' + i + '" data-done="Задание скопировано: вставьте его в нейросеть">Скопировать задание</button></div></details></div>' +
          '<div class="layer"><div class="layer-t">ИНСТРУМЕНТ, КОТОРЫЙ ДЕЛАЕТ ЭТО САМ</div><p>' + esc(t.build) + "</p>" +
          (ex ? '<p class="small">Пример: <a href="' + esc(ex.url) + '" target="_blank" rel="noopener">' + esc(ex.label) + "</a></p>" : "") +
          '<p class="errs"><b>Где ошибается:</b> ' + esc(t.errs) + '</p><p class="small"><a href="' + (CFG.taskBase || base + "zadachi/") + t.slug + '/">Подробно об этой задаче →</a></p></div></article>';
      });
      h += '<div class="course-box"><h3>' + esc(CFG.courseTitle || "Довести до работы на ваших данных: 6 встреч") + "</h3><p>" + esc(CFG.courseText || "") + '</p><div class="cta-row">' +
        '<button class="btn btn-main" data-write="' + esc(msg) + '" data-where="podbor">Хочу собрать это на курсе <span class="arr">→</span></button>' +
        '<button class="btn btn-line" data-share="">Отправить знакомому</button></div><p class="small" style="margin:8px 0 0"><button class="linkbtn js-restart">Подобрать заново</button></p></div>';
      res.innerHTML = h;
    }
    function writeHash() { history.replaceState(null, "", "#p=" + state.pains.join(",") + "&s=" + state.sphere); }
    function readHash() {
      var m = location.hash.match(/p=([a-z,]+)&s=([a-z]*)/);
      if (!m) return;
      state.pains = m[1].split(",").filter(function (p) { return PAIN_TASKS[p]; });
      state.sphere = m[2];
      if (!state.pains.length) return;
      state.pains.forEach(function (p) { var o = $('.opt[data-v="' + p + '"]', steps[0]); if (o) o.setAttribute("aria-pressed", "true"); });
      var so = $('.opt[data-v="' + state.sphere + '"]', steps[1]); if (so) so.setAttribute("aria-pressed", "true");
      $(".js-next", steps[0]).disabled = false;
      load(function () { render(); show(2); });
    }
    $(".js-next", steps[0]).disabled = true;
    show(0); readHash();
  }

  /* ---------- Фильтры каталога и библиотеки ---------- */
  $$(".filters").forEach(function (f) {
    var target = $(f.getAttribute("data-target")), attr = f.getAttribute("data-attr");
    $$(".opt", f).forEach(function (o) {
      o.addEventListener("click", function () {
        var v = o.getAttribute("data-v");
        $$(".opt", f).forEach(function (x) { x.setAttribute("aria-pressed", x === o ? "true" : "false"); });
        $$("[data-" + attr + "]", target).forEach(function (c) {
          var vals = (c.getAttribute("data-" + attr) || "").split(" ");
          c.classList.toggle("hide", v !== "all" && vals.indexOf(v) < 0 && vals.indexOf("any") < 0);
        });
      });
    });
  });
})();
