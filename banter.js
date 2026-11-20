/* FaceGrabs message board widget. Plain JS, no framework, no third-party scripts, no cookies or storage.
   Usage: <div id="fg-banter"></div> plus window.FG_BANTER = { API_BASE, SLUG } before this script.
   All text from the server is inserted with textContent, never innerHTML. */
(function () {
  "use strict";
  var CFG = window.FG_BANTER || {};
  var API = String(CFG.API_BASE || "").replace(/\/+$/, "");
  var SLUG = CFG.SLUG || "peast-mode";
  var EMAIL = CFG.EMAIL || "facegrabs.dev@gmail.com";
  var MAX = 400;
  var root = document.getElementById(CFG.MOUNT_ID || "fg-banter");
  if (!root) return;
  root.className = (root.className ? root.className + " " : "") + "fgb";

  var BADGES = ["Wilting", "Perky", "Plump", "Fit", "Toned", "Strong", "Jacked", "Pea-st Mode"];
  var KINDS = [["cheer", "Cheer"], ["flex", "Flex"], ["heart", "Heart"], ["laugh", "Laugh"]];
  /* simple line icons, drawn in the board's green (CSS currentColor on .fgb-ic) */
  var ICONS = {
    cheer: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M5.6 5.6l2.8 2.8", "M15.6 15.6l2.8 2.8", "M5.6 18.4l2.8-2.8", "M15.6 8.4l2.8-2.8"],
    flex: ["M6.5 7v10", "M3.5 9.5v5", "M17.5 7v10", "M20.5 9.5v5", "M6.5 12h11"],
    heart: ["M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"],
    laugh: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M8 14c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4", "M9 9.5h.01", "M15 9.5h.01"]
  };
  function icon(kind) {
    var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.setAttribute("class", "fgb-ic");
    ICONS[kind].forEach(function (d) { var p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.appendChild(p); });
    return svg;
  }
  var ADJ = ["Cozy", "Sunny", "Perky", "Plump", "Mellow", "Jolly", "Zesty", "Snug", "Breezy", "Cheery", "Humble", "Peppy", "Gentle", "Spry", "Merry"];
  var NOUN = ["Leek", "Radish", "Turnip", "Sprout", "Bean", "Fern", "Beet", "Clover", "Pea Pod", "Basil", "Kale", "Acorn", "Sprig", "Gourd", "Chive"];
  var NAP = "The board is taking a nap.";

  var S = { ft: null, ftAt: 0, turnstile: false, offset: 0, nick: "", badge: "" };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var randNick = function () { return pick(ADJ) + " " + pick(NOUN); };
  S.nick = randNick();

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function api(method, path, body) {
    var opt = { method: method, credentials: "omit", referrerPolicy: "no-referrer", headers: {} };
    if (body) { opt.body = JSON.stringify(body); opt.headers["content-type"] = "application/json"; }
    return fetch(API + path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, json: j }; });
    });
  }
  function ago(t) {
    var s = Math.max(0, Math.floor(Date.now() / 1000) - t);
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " hr ago";
    if (s < 86400 * 30) return Math.round(s / 86400) + " days ago";
    return new Date(t * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function status(box, kind, text) { box.className = "fgb-status " + kind; box.textContent = text; box.hidden = !text; }

  // ---------- static parts ----------
  var rules = el("details", { class: "fgb-rules" }, [
    el("summary", { text: "House rules" }),
    el("ul", {}, [
      el("li", { text: "Be kind. Happy gym-bro energy only: no loud grunts, no slamming weights, no gallon jugs of water. We are all on the same journey, just at different stages." }),
      el("li", { text: "Honest feedback is welcome, grumpy kind included. Aim it at the watch face, never at each other." }),
      el("li", { text: "Hide spoilers about secret moves behind a warning, so others get to discover them." }),
      el("li", { text: "No links, emails, phone numbers or selling. Plain words only, for everyone's safety." }),
      el("li", { text: "Your first message gets a quick check before it shows, then you are free to chat." })
    ])
  ]);

  var nickIn, badgeSel, bodyIn, count, hp, postBtn, formStatus, list, moreBtn, form;
  function buildForm() {
    nickIn = el("input", { type: "text", id: "fgb-nick", maxlength: "24", autocomplete: "off", spellcheck: "false", value: S.nick });
    var shuffle = el("button", { type: "button", class: "fgb-btn fgb-ghost", "aria-label": "Suggest another nickname", text: "Shuffle", onclick: function () { nickIn.value = randNick(); S.nick = nickIn.value; } });
    badgeSel = el("select", { id: "fgb-badge" }, [el("option", { value: "", text: "No stage, just here for the vibes" })].concat(BADGES.map(function (b) { return el("option", { value: b, text: b }); })));
    bodyIn = el("textarea", { id: "fgb-body", maxlength: String(MAX), rows: "3", required: true, "aria-required": "true", "aria-describedby": "fgb-count", placeholder: "Tell us your stage, your critter story, or cheer someone on." });
    count = el("p", { class: "fgb-count", id: "fgb-count", text: MAX + " characters left" });
    hp = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    postBtn = el("button", { type: "submit", class: "fgb-btn pri", text: "Post to the board" });
    formStatus = el("p", { class: "fgb-status", role: "status", hidden: true });
    bodyIn.addEventListener("input", function () { counter(bodyIn, count); });
    nickIn.addEventListener("input", function () { S.nick = nickIn.value; });
    form = el("form", { class: "fgb-form", "aria-labelledby": "fgb-form-h", novalidate: true, onsubmit: function (e) { e.preventDefault(); submit(null, nickIn, badgeSel, bodyIn, hp, postBtn, formStatus, count); } }, [
      el("h3", { id: "fgb-form-h", class: "fgb-sr", text: "Post a message" }),
      el("div", { class: "fgb-f" }, [el("label", { for: "fgb-body", text: "Your message" }), bodyIn, count]),
      el("div", { class: "fgb-row" }, [
        el("div", { class: "fgb-f" }, [el("label", { for: "fgb-nick" }, ["Nickname ", el("span", { class: "fgb-hint", text: "(optional)" })]), el("div", { class: "fgb-nickrow" }, [nickIn, shuffle])]),
        el("div", { class: "fgb-f" }, [el("label", { for: "fgb-badge" }, ["Your stage ", el("span", { class: "fgb-hint", text: "(optional)" })]), badgeSel])
      ]),
      el("div", { class: "fgb-hp", "aria-hidden": "true" }, [el("label", { for: "fgb-hp", text: "Leave this empty" }), hp]),
      el("div", { class: "fgb-actions" }, [postBtn]),
      formStatus
    ]);
    hp.id = "fgb-hp";
    var stageF = badgeSel.parentNode; stageF.hidden = true;
    var addStage = el("button", { type: "button", class: "fgb-link", "aria-expanded": "false", text: "Add a stage", onclick: function () { stageF.hidden = false; addStage.hidden = true; addStage.setAttribute("aria-expanded", "true"); badgeSel.focus(); } });
    form.querySelector(".fgb-actions").appendChild(addStage);
  }
  function counter(ta, out) {
    var left = MAX - ta.value.length;
    out.textContent = left + " characters left"; out.className = "fgb-count" + (left < 40 ? " warn" : "");
  }

  // ---------- messages ----------
  function msgNode(m, isReply) {
    var head = el("div", { class: "fgb-head" }, [el("span", { class: "fgb-nick", text: m.nick })]);
    if (m.is_crew) head.appendChild(el("span", { class: "fgb-crew", text: "Crew" }));
    if (m.badge) head.appendChild(el("span", { class: "fgb-pill", text: m.badge }));
    head.appendChild(el("span", { class: "fgb-time", text: ago(m.created) }));
    var li = el("li", { class: "fgb-msg", id: "fgb-m" + m.id }, [head]);
    if (m.title) li.appendChild(el("p", { class: "fgb-title", text: m.title }));
    li.appendChild(el("p", { class: "fgb-body", text: m.body }));
    var tools = el("div", { class: "fgb-tools", role: "group", "aria-label": "Reactions and actions for " + m.nick });
    KINDS.forEach(function (k) {
      var n = (m.reactions && m.reactions[k[0]]) || 0;
      var b = el("button", { type: "button", class: "fgb-r", "aria-pressed": m.mine === k[0] ? "true" : "false", "aria-label": k[1] + (n ? ", " + n : "") + (m.mine === k[0] ? ", you reacted" : "") }, [icon(k[0]), el("span", { text: k[1] }), n ? el("span", { class: "fgb-n", text: String(n) }) : null]);
      b.addEventListener("click", function () { react(m, k[0], b); });
      tools.appendChild(b);
    });
    if (!isReply) {
      var replyBox = el("div");
      var rb = el("button", { type: "button", class: "fgb-link", "aria-expanded": "false", text: "Reply" });
      rb.addEventListener("click", function () { toggleReply(m, replyBox, rb); });
      tools.appendChild(rb); li._replyBox = replyBox;
    }
    var rep = el("button", { type: "button", class: "fgb-link", text: "Report" });
    rep.addEventListener("click", function () { askReport(m, rep); });
    tools.appendChild(rep);
    li.appendChild(tools);
    if (!isReply) {
      li.appendChild(li._replyBox);
      if (m.replies && m.replies.length) li.appendChild(el("ul", { class: "fgb-replies", "aria-label": "Replies to " + m.nick }, m.replies.map(function (r) { return msgNode(r, true); })));
    }
    return li;
  }
  function react(m, kind, btn) {
    var same = m.mine === kind;
    api("POST", "/api/react", { id: m.id, kind: same ? "" : kind }).then(function (r) {
      if (!r.ok) { live(r.json.message || "Could not react just now."); return; }
      var old = m.mine; m.reactions = m.reactions || {};
      if (old) m.reactions[old] = Math.max(0, (m.reactions[old] || 1) - 1);
      m.mine = r.json.mine;
      if (m.mine) m.reactions[m.mine] = (m.reactions[m.mine] || 0) + 1;
      var li = document.getElementById("fgb-m" + m.id), parent = li.parentNode, fresh = msgNode(m, !!m.parent_id);
      parent.replaceChild(fresh, li);
      var again = fresh.querySelector('.fgb-r[aria-pressed="true"]') || fresh.querySelector(".fgb-r"); again.focus();
    }, function () { live(NAP); });
  }
  function askReport(m, btn) {
    var box = btn.parentNode;
    var yes = el("button", { type: "button", class: "fgb-link", text: "Yes, report it" }), no = el("button", { type: "button", class: "fgb-link", text: "Never mind" });
    var q = el("span", { class: "fgb-hint", role: "group", "aria-label": "Confirm report" }, ["Report this message to the crew? ", yes, no]);
    btn.hidden = true; box.appendChild(q); yes.focus();
    no.addEventListener("click", function () { q.remove(); btn.hidden = false; btn.focus(); });
    yes.addEventListener("click", function () {
      api("POST", "/api/report", { id: m.id }).then(function (r) { q.textContent = r.ok ? "Thanks, the crew will take a look." : (r.json.message || "Could not send that just now."); }, function () { q.textContent = NAP; });
    });
  }
  function toggleReply(m, box, btn) {
    if (box.firstChild) { box.textContent = ""; btn.setAttribute("aria-expanded", "false"); return; }
    btn.setAttribute("aria-expanded", "true");
    var nick = el("input", { type: "text", maxlength: "24", autocomplete: "off", value: nickIn.value, "aria-label": "Nickname for your reply" });
    var ta = el("textarea", { maxlength: String(MAX), rows: "3", "aria-label": "Your reply to " + m.nick, "aria-describedby": "fgb-rc" + m.id });
    var c = el("p", { class: "fgb-count", id: "fgb-rc" + m.id, text: MAX + " characters left" });
    var hp2 = el("input", { type: "text", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    var go = el("button", { type: "submit", class: "fgb-btn pri", text: "Post reply" });
    var st = el("p", { class: "fgb-status", role: "status", hidden: true });
    ta.addEventListener("input", function () { counter(ta, c); });
    var f = el("form", { class: "fgb-replyform", novalidate: true, onsubmit: function (e) { e.preventDefault(); submit(m.id, nick, { value: badgeSel.value }, ta, hp2, go, st, c); } }, [
      el("div", { class: "fgb-f" }, [nick]), el("div", { class: "fgb-f", style: "margin-top:8px" }, [ta, c]), el("div", { class: "fgb-hp", "aria-hidden": "true" }, [hp2]), go, st]);
    box.appendChild(f); ta.focus();
  }
  var liveEl;
  function live(t) { liveEl.textContent = ""; setTimeout(function () { liveEl.textContent = t; }, 30); }

  // ---------- posting ----------
  function submit(parentId, nickEl, badgeEl, bodyEl, hpEl, btn, st, cnt, retried) {
    if (!bodyEl.value.trim()) { status(st, "err", "Write a few words first."); bodyEl.focus(); return; }
    btn.disabled = true; status(st, "ok", "Posting...");
    var body = { slug: SLUG, nick: nickEl.value.trim(), badge: badgeEl.value, body: bodyEl.value, parent_id: parentId, hp: hpEl.value, ft: S.ft };
    if (S.turnstile && window.turnstile) body.cf = turnstileToken();
    api("POST", "/api/messages", body).then(function (r) {
      if (r.ok && r.json.ok) {
        status(st, "ok", r.json.message || "Thanks, your message is in!"); bodyEl.value = ""; counter(bodyEl, cnt); btn.disabled = false;
        if (r.json.status === "published") load(true);
      } else if (r.json && r.json.error === "fast" && !retried) {
        setTimeout(function () { submit(parentId, nickEl, badgeEl, bodyEl, hpEl, btn, st, cnt, true); }, 4500);
      } else if (r.json && r.json.error === "form") {
        status(st, "err", "Refreshing the form, one moment..."); load(true, function () { btn.disabled = false; status(st, "err", "Please press Post again."); });
      } else { status(st, "err", (r.json && r.json.message) || "That did not go through. Please try again."); btn.disabled = false; }
    }, function () { status(st, "err", NAP + " Try again in a bit, or email " + EMAIL + "."); btn.disabled = false; });
  }
  var tsBox = null, tsId = null;
  function turnstileToken() { try { return window.turnstile.getResponse(tsId); } catch (e) { return ""; } }
  function setupTurnstile() {   // optional, off unless the server says so AND CFG.TURNSTILE_SITEKEY is set
    if (!S.turnstile || !CFG.TURNSTILE_SITEKEY || tsBox) return;
    tsBox = el("div", { class: "fgb-f" }); form.insertBefore(tsBox, form.querySelector(".fgb-actions"));
    var s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
    s.onload = function () { tsId = window.turnstile.render(tsBox, { sitekey: CFG.TURNSTILE_SITEKEY }); };
    document.head.appendChild(s);
  }

  // ---------- loading ----------
  function nap() {
    root.textContent = "";
    root.appendChild(el("div", { class: "fgb-nap", role: "status" }, [
      el("p", {}, [el("strong", { text: NAP })]),
      el("p", {}, ["He is just resting his legs. Try again in a little while, or ", el("a", { href: "mailto:" + EMAIL, text: "email us" }), " and we will pop your message on the board."])
    ]));
  }
  function load(refresh, done) {
    api("GET", "/api/board?slug=" + encodeURIComponent(SLUG) + "&offset=" + (refresh ? 0 : S.offset)).then(function (r) {
      if (!r.ok) { if (!S.loaded) nap(); else live(NAP); if (done) done(); return; }
      S.loaded = true;
      var j = r.json;
      if (!S.ft || Date.now() - S.ftAt > 5 * 3600 * 1000) { S.ft = j.ft; S.ftAt = Date.now(); }
      S.turnstile = !!j.turnstile; setupTurnstile();
      if (refresh) { list.textContent = ""; S.offset = 0; }
      j.messages.forEach(function (m) { list.appendChild(msgNode(m, false)); });
      S.offset += j.messages.length;
      moreBtn.hidden = !j.more;
      if (!list.children.length) list.appendChild(el("li", { class: "fgb-empty", text: "Nothing here yet. Be the first to say hello!" }));
      if (done) done();
    }, function () { if (!S.loaded) nap(); else live(NAP); if (done) done(); });
  }

  // ---------- compact mode: latest 3 posts, read only ----------
  if (CFG.COMPACT) {
    root.className += " fgb-compact";
    if (!API || API.indexOf("REPLACE_") !== -1) { root.textContent = NAP; return; }
    api("GET", "/api/board?slug=" + encodeURIComponent(SLUG) + "&offset=0").then(function (r) {
      var msgs = (r.ok && r.json.messages) ? r.json.messages.filter(function (m) { return !m.parent_id; }).slice(0, 3) : null;
      root.textContent = "";
      if (!msgs) { root.appendChild(el("p", { class: "fgb-empty", text: NAP + " Try again in a little while." })); return; }
      if (!msgs.length) { root.appendChild(el("p", { class: "fgb-empty", text: "Nothing here yet. Be the first to say hello!" })); return; }
      var ul = el("ul", { class: "fgb-list", "aria-label": "Latest messages" });
      msgs.forEach(function (m) {
        var head = el("div", { class: "fgb-head" }, [el("span", { class: "fgb-nick", text: m.nick })]);
        if (m.is_crew) head.appendChild(el("span", { class: "fgb-crew", text: "Crew" }));
        if (m.badge) head.appendChild(el("span", { class: "fgb-pill", text: m.badge }));
        head.appendChild(el("span", { class: "fgb-time", text: ago(m.created) }));
        var t = m.body.length > 150 ? m.body.slice(0, 147).replace(/\s+\S*$/, "") + "..." : m.body;
        ul.appendChild(el("li", { class: "fgb-msg" }, [head, el("p", { class: "fgb-body", text: t })]));
      });
      root.appendChild(ul);
    }, function () { root.textContent = ""; root.appendChild(el("p", { class: "fgb-empty", text: NAP + " Try again in a little while." })); });
    return;
  }

  // ---------- boot ----------
  if (!API || API.indexOf("REPLACE_") !== -1) { nap(); return; }
  buildForm();
  liveEl = el("div", { class: "fgb-sr", role: "status", "aria-live": "polite" });
  list = el("ul", { class: "fgb-list", "aria-label": "Messages" });
  moreBtn = el("button", { type: "button", class: "fgb-btn", text: "Show older messages", hidden: true, onclick: function () { load(false); } });
  root.textContent = "";
  root.appendChild(form); root.appendChild(rules); root.appendChild(liveEl); root.appendChild(list); root.appendChild(moreBtn);
  load(true);
})();
