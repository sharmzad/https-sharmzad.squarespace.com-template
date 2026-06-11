/* =========================================================
   Shoe Size Scanner — foot measurement logic
   Method: a bank card (ISO/IEC 7810 ID-1, long edge = 85.60 mm)
   placed beside the foot gives the px -> mm scale. The user drags
   markers onto the card edge and the foot (heel + longest toe);
   we convert the measured foot length to an EU shoe size.
   No backend, no dependencies — runs entirely in the browser.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- constants ---------- */
  var CARD_LONG_MM = 85.6;        // ISO ID-1 long edge
  var TOE_ALLOWANCE_MM = 16.7;    // ease added to foot length for the shoe last
  var PARIS_POINT_MM = 2 / 3 * 10; // 1 Paris point = 6.667 mm
  var SVG_NS = "http://www.w3.org/2000/svg";

  /* ---------- elements ---------- */
  var fileInput = document.getElementById("file");
  var fileLabel = document.getElementById("fileLabel");
  var resetBtn = document.getElementById("resetBtn");
  var stage = document.getElementById("stage");
  var img = document.getElementById("shot");
  var svg = document.getElementById("overlay");
  var empty = document.getElementById("empty");
  var result = document.getElementById("result");
  var euSizeEl = document.getElementById("euSize");
  var footLenEl = document.getElementById("footLen");
  var altSizesEl = document.getElementById("altSizes");
  var noteEl = document.getElementById("resultNote");

  /* ---------- state ---------- */
  // Coordinates are stored in the image's natural pixel space, which
  // is exactly the SVG viewBox, so 1 unit === 1 source pixel.
  var W = 0, H = 0;
  var handles = null;     // { card1, card2, heel, toe } -> {x, y, el, ...}
  var moved = false;      // has the user adjusted any handle yet?

  /* ---------- load a photo ---------- */
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      W = img.naturalWidth;
      H = img.naturalHeight;
      stage.style.aspectRatio = W + " / " + H;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      buildOverlay();
      empty.hidden = true;
      stage.hidden = false;
      result.hidden = false;
      resetBtn.hidden = false;
      fileLabel.textContent = "📷 Use a different photo";
      moved = false;
      compute();
    };
    img.src = url;
  });

  resetBtn.addEventListener("click", function () {
    if (W && H) { buildOverlay(); moved = false; compute(); }
  });

  /* ---------- build draggable markers + lines ---------- */
  function buildOverlay() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var unit = Math.max(W, H);
    var ringR = unit * 0.018;
    var hitR = unit * 0.055;
    var stroke = Math.max(2, unit * 0.005);
    var font = unit * 0.032;

    // Default starting positions: card along a lower-left diagonal,
    // foot vertical near the centre. The user drags them into place.
    handles = {
      card1: { x: W * 0.18, y: H * 0.78, color: "#6aa6ff", label: "Card" },
      card2: { x: W * 0.18, y: H * 0.50, color: "#6aa6ff", label: "Card" },
      heel:  { x: W * 0.58, y: H * 0.86, color: "#3ddc97", label: "Heel" },
      toe:   { x: W * 0.58, y: H * 0.16, color: "#3ddc97", label: "Toe" }
    };

    // lines
    handles._cardLine = line("#6aa6ff", stroke);
    handles._footLine = line("#3ddc97", stroke);
    svg.appendChild(handles._cardLine);
    svg.appendChild(handles._footLine);

    // measurement text labels
    handles._cardTxt = text("#6aa6ff", font, stroke);
    handles._footTxt = text("#3ddc97", font, stroke);
    svg.appendChild(handles._cardTxt);
    svg.appendChild(handles._footTxt);

    // handles (drawn last so they sit on top)
    ["card1", "card2", "heel", "toe"].forEach(function (key) {
      makeHandle(key, ringR, hitR, font, stroke);
    });

    redraw();
  }

  function line(color, w) {
    var l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("class", "measure-line");
    l.setAttribute("stroke", color);
    l.setAttribute("stroke-width", w);
    l.setAttribute("stroke-dasharray", w * 2 + " " + w * 2);
    return l;
  }

  function text(color, size, stroke) {
    var t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("class", "measure-label");
    t.setAttribute("fill", color);
    t.setAttribute("font-size", size);
    t.setAttribute("stroke-width", stroke * 0.8);
    t.setAttribute("text-anchor", "middle");
    return t;
  }

  function makeHandle(key, ringR, hitR, font, stroke) {
    var h = handles[key];
    var g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "handle");

    var hit = document.createElementNS(SVG_NS, "circle");
    hit.setAttribute("class", "handle__hit");
    hit.setAttribute("r", hitR);

    var ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("r", ringR * 1.7);
    ring.setAttribute("fill", "rgba(0,0,0,.45)");

    var dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("r", ringR);
    dot.setAttribute("fill", h.color);
    dot.setAttribute("stroke", "#fff");
    dot.setAttribute("stroke-width", stroke * 0.6);

    var lbl = document.createElementNS(SVG_NS, "text");
    lbl.setAttribute("class", "measure-label");
    lbl.setAttribute("fill", "#fff");
    lbl.setAttribute("font-size", font * 0.62);
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("dy", -ringR * 2);
    lbl.setAttribute("stroke-width", stroke * 0.6);
    lbl.textContent = h.label;

    g.appendChild(hit);
    g.appendChild(ring);
    g.appendChild(dot);
    g.appendChild(lbl);
    svg.appendChild(g);

    h.el = g;
    attachDrag(g, key);
  }

  /* ---------- pointer dragging ---------- */
  function attachDrag(g, key) {
    g.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      g.setPointerCapture(ev.pointerId);

      function move(e) {
        var p = toSvg(e.clientX, e.clientY);
        var h = handles[key];
        h.x = clamp(p.x, 0, W);
        h.y = clamp(p.y, 0, H);
        moved = true;
        redraw();
        compute();
      }
      function up(e) {
        g.releasePointerCapture(ev.pointerId);
        g.removeEventListener("pointermove", move);
        g.removeEventListener("pointerup", up);
        g.removeEventListener("pointercancel", up);
      }
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", up);
      g.addEventListener("pointercancel", up);
    });
  }

  // client coords -> svg user units
  function toSvg(clientX, clientY) {
    var pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /* ---------- redraw lines + handle positions ---------- */
  function redraw() {
    place(handles.card1); place(handles.card2);
    place(handles.heel); place(handles.toe);

    seg(handles._cardLine, handles.card1, handles.card2);
    seg(handles._footLine, handles.heel, handles.toe);

    mid(handles._cardTxt, handles.card1, handles.card2, "85.6 mm");
  }

  function place(h) { h.el.setAttribute("transform", "translate(" + h.x + "," + h.y + ")"); }

  function seg(l, a, b) {
    l.setAttribute("x1", a.x); l.setAttribute("y1", a.y);
    l.setAttribute("x2", b.x); l.setAttribute("y2", b.y);
  }

  function mid(t, a, b, str) {
    t.setAttribute("x", (a.x + b.x) / 2);
    t.setAttribute("y", (a.y + b.y) / 2);
    t.textContent = str;
  }

  /* ---------- compute size ---------- */
  function compute() {
    var cardPx = dist(handles.card1, handles.card2);
    var footPx = dist(handles.heel, handles.toe);
    if (cardPx < 1) return;

    var mmPerPx = CARD_LONG_MM / cardPx;
    var footMm = footPx * mmPerPx;
    var footCm = footMm / 10;

    // foot length label on the foot line
    mid(handles._footTxt, handles.heel, handles.toe, footCm.toFixed(1) + " cm");

    // EU (Paris point) size from the shoe-last length
    var euExact = (footMm + TOE_ALLOWANCE_MM) / PARIS_POINT_MM;
    var eu = Math.round(euExact);

    // cross-system estimates (Brannock-based)
    var inch = footMm / 25.4;
    var usMen = Math.round((3 * inch - 22) * 2) / 2;
    var usWomen = usMen + 1.5;
    var uk = Math.round((usMen - 1) * 2) / 2;

    footLenEl.textContent = footCm.toFixed(1) + " cm (" + Math.round(footMm) + " mm)";

    if (!moved) {
      euSizeEl.textContent = "—";
      altSizesEl.textContent = "";
      noteEl.textContent = "Drag the markers onto your card edge and your foot to read your size.";
      return;
    }

    euSizeEl.textContent = String(eu);
    altSizesEl.textContent =
      "Approx. elsewhere — UK " + fmt(uk) + " · US M " + fmt(usMen) + " · US W " + fmt(usWomen);
    noteEl.textContent =
      "Measured EU " + euExact.toFixed(1) + ". Between sizes? Pick the larger. Measure both feet and use the bigger one.";
  }

  function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
})();
