/*  arsd_build.jsx — сборка рилса в After Effects по гайду arsd (docs/style-guide.md).

    Запуск: File → Scripts → Run Script File… → этот файл → выбрать projects/<проект>/ae/clip_data.jsxinc
    (clip_data.jsxinc делает _build/ae_export.py).

    Что собирает (в текущем проекте, в папке arsd_<проект>):
      SPEAKER   — куски исходника: кадрирование 9:16 (глаза y≈640), медленный наезд, punch-in, фейды звука на склейках (3.2, 4)
      SUBTITLES — субтитры Montserrat Bold 68 px, y 1250, по словам с T1, акценты Playfair Italic (6, 7.1)
      I1…I7     — вставки S2 «белая редакционная карточка», ч/б (8.3, 9)
      REEL_…    — главная композиция 1080×1920: спикер (цвет 4.3), расфокус под вставками, заголовок-хук, SFX, музыка
    Нет картинки / звука / шрифта — ставит заглушку и пишет список в конце. Докинули файлы — запустите заново.
    ExtendScript (ES3): без let/const/стрелок/forEach.
*/
#target aftereffects

(function arsdBuild() {
    var dataFile = File.openDialog("Выберите ae/clip_data.jsxinc проекта", "*.jsxinc");
    if (!dataFile) { return; }
    dataFile.encoding = "UTF-8";
    dataFile.open("r");
    var CLIP;
    eval(dataFile.read());                        // var CLIP = {...}
    dataFile.close();
    if (!CLIP) { alert("В файле нет данных CLIP"); return; }

    var PROJ = dataFile.parent.parent;           // projects/<проект>
    var C = CLIP, S = CLIP.style, FPS = CLIP.fps, W = CLIP.width, H = CLIP.height;
    var FR = 1 / FPS;
    var missing = { fonts: {}, images: {}, sfx: {}, other: [] };

    app.beginUndoGroup("arsd build " + C.name);

    // ---------- утилиты ----------
    function rgb(c) { return [c[0] / 255, c[1] / 255, c[2] / 255]; }
    function rgba(c) { return [c[0] / 255, c[1] / 255, c[2] / 255, 1]; }
    function projFile(rel) { return new File(PROJ.fsName + "/" + rel); }
    function tr(l) { return l.property("ADBE Transform Group"); }
    function P(l, name) {
        var map = { anchor: "ADBE Anchor Point", pos: "ADBE Position", scale: "ADBE Scale",
                    rot: "ADBE Rotate Z", op: "ADBE Opacity" };
        return tr(l).property(map[name]);
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    var root = app.project.items.addFolder("arsd_" + C.name);
    function inFolder(item) { item.parentFolder = root; return item; }

    var importCache = {};
    function importRel(rel, kind) {
        if (importCache[rel]) { return importCache[rel]; }
        var f = projFile(rel);
        if (!f.exists) {
            if (kind) { missing[kind][rel] = true; }
            return null;
        }
        var item = app.project.importFile(new ImportOptions(f));
        inFolder(item);
        importCache[rel] = item;
        return item;
    }

    function easeDims(prop) {
        var t = prop.propertyValueType;
        if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) { return 1; }
        if (t === PropertyValueType.TwoD) { return 2; }
        if (t === PropertyValueType.ThreeD) { return 3; }
        return 1;
    }
    // ease-out без отскока (гайд 7.1: cubic-bezier(0.22,1,0.36,1)): быстрый старт, длинное торможение
    function anim(prop, t0, t1, v0, v1) {
        prop.setValueAtTime(t0, v0);
        prop.setValueAtTime(t1, v1);
        var k0 = prop.nearestKeyIndex(t0), k1 = prop.nearestKeyIndex(t1), n = easeDims(prop), e = [], i;
        for (i = 0; i < n; i++) { e.push(new KeyframeEase(0, 88)); }
        try {
            prop.setInterpolationTypeAtKey(k0, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
            prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            prop.setTemporalEaseAtKey(k1, e, e);
        } catch (err) {}
    }
    function smooth(prop, t0, t1, v0, v1) {    // плавный наезд / дрейф: easy ease с двух сторон
        prop.setValueAtTime(t0, v0);
        prop.setValueAtTime(t1, v1);
        var n = easeDims(prop), e = [], i;
        for (i = 0; i < n; i++) { e.push(new KeyframeEase(0, 40)); }
        try {
            prop.setTemporalEaseAtKey(prop.nearestKeyIndex(t0), e, e);
            prop.setTemporalEaseAtKey(prop.nearestKeyIndex(t1), e, e);
        } catch (err) {}
    }
    function fx(l, match) { return l.property("ADBE Effect Parade").addProperty(match); }
    function blurFx(l) {
        var b = fx(l, "ADBE Gaussian Blur 2");
        try { b.property(3).setValue(1); } catch (e) {}   // Repeat Edge Pixels
        return b.property(1);
    }
    function pct(prop, v) {                               // у Drop Shadow непрозрачность бывает 0–255
        return (prop.hasMax && prop.maxValue > 100) ? v * 2.55 : v;
    }
    function shadow(l, opacity, dist, soft, dir) {
        var d = fx(l, "ADBE Drop Shadow");
        d.property(1).setValue([0, 0, 0]);
        d.property(2).setValue(pct(d.property(2), opacity));
        d.property(3).setValue(dir === undefined ? 180 : dir);
        d.property(4).setValue(dist);
        d.property(5).setValue(soft);
        return d;
    }

    // ---------- шрифты ----------
    var FONT_FALLBACK = {
        "Coolvetica|Regular": ["Coolvetica-Regular", "CoolveticaRg-Regular", "Coolvetica"],
        "Coolvetica|Italic": ["Coolvetica-Italic", "CoolveticaRg-Italic"],
        "Montserrat|Bold": ["Montserrat-Bold"], "Montserrat|Light": ["Montserrat-Light"],
        "Montserrat|Medium": ["Montserrat-Medium"], "Playfair Display|Italic": ["PlayfairDisplay-Italic"]
    };
    var fontCache = {};
    function font(key) {
        var fam = S.fonts[key][0], sty = S.fonts[key][1], id = fam + "|" + sty;
        if (fontCache[id]) { return fontCache[id]; }
        var ps = null, cands = FONT_FALLBACK[id] || [fam.replace(/ /g, "") + "-" + sty], i, r;
        try {
            if (app.fonts && app.fonts.getFontsByFamilyNameAndStyleName) {
                r = app.fonts.getFontsByFamilyNameAndStyleName(fam, sty);
                if (r && r.length) { ps = r[0].postScriptName; }
                for (i = 0; !ps && i < cands.length; i++) {
                    r = app.fonts.getFontsByPostScriptName(cands[i]);
                    if (r && r.length) { ps = cands[i]; }
                }
                if (!ps) { missing.fonts[fam + " " + sty] = true; }
            }
        } catch (e) {}
        fontCache[id] = ps || cands[0];
        return fontCache[id];
    }

    // ---------- текст ----------
    function text(comp, str, fontKey, size, color, just, tracking, leading) {
        var l = comp.layers.addText(str);
        var td = l.property("ADBE Text Properties").property("ADBE Text Document");
        var d = td.value;
        try { d.resetCharStyle(); } catch (e) {}
        d.font = font(fontKey);
        d.fontSize = size;
        d.applyFill = true;
        d.fillColor = rgb(color);
        d.applyStroke = false;
        d.tracking = tracking || 0;
        if (leading) { d.autoLeading = false; d.leading = leading; }
        d.justification = just || ParagraphJustification.CENTER_JUSTIFY;
        td.setValue(d);
        l.name = str.replace(/[\r\n]+/g, " ").substr(0, 30);
        return l;
    }
    function centerAnchor(l, t) {
        var r = l.sourceRectAtTime(t || 0, false);
        P(l, "anchor").setValue([r.left + r.width / 2, r.top + r.height / 2]);
        return r;
    }
    function placeText(l, x, y, t) { centerAnchor(l, t); P(l, "pos").setValue([x, y]); return l; }

    // Т1: мягкое появление (7.1) — opacity, blur 16→0, y +30→0
    function T1(l, t, y, blurFrom, dy) {
        var d = S.T1, b = blurFx(l);
        anim(P(l, "op"), t, t + d, 0, 100);
        anim(b, t, t + d, blurFrom || 16, 0);
        var p = P(l, "pos").value;
        anim(P(l, "pos"), t, t + d, [p[0], y + (dy === undefined ? 30 : dy)], [p[0], y]);
    }
    // Т2: огромное слово встаёт (7.2) — scale 112→100, blur 24→0
    function T2(l, t) {
        var d = S.T2, b = blurFx(l);
        anim(P(l, "op"), t, t + d * 0.6, 0, 100);
        anim(P(l, "scale"), t, t + d, [112, 112], [100, 100]);
        anim(b, t, t + d, 24, 0);
    }
    // Т6: исчезновение (7.6)
    function T6(l, t) {
        var d = S.T6;
        anim(P(l, "op"), t, t + d, 100, 0);
        var b = l.property("ADBE Effect Parade").property("ADBE Gaussian Blur 2");
        if (b) { anim(b.property(1), t, t + d, 0, 10); }
    }

    // ---------- фигуры ----------
    function shapeLayer(comp, name, x, y) {
        var l = comp.layers.addShape();
        l.name = name;
        P(l, "pos").setValue([x === undefined ? W / 2 : x, y === undefined ? H / 2 : y]);
        return l;
    }
    function group(l, name) {
        var g = l.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.name = name || "g";
        return g;
    }
    function gv(g) { return g.property("ADBE Vectors Group"); }
    function rect(g, w, h, r, cx, cy) {
        var p = gv(g).addProperty("ADBE Vector Shape - Rect");
        p.property("ADBE Vector Rect Size").setValue([w, h]);
        p.property("ADBE Vector Rect Roundness").setValue(r || 0);
        if (cx !== undefined) { p.property("ADBE Vector Rect Position").setValue([cx, cy]); }
        return p;
    }
    function ellipse(g, w, h, cx, cy) {
        var p = gv(g).addProperty("ADBE Vector Shape - Ellipse");
        p.property("ADBE Vector Ellipse Size").setValue([w, h]);
        if (cx !== undefined) { p.property("ADBE Vector Ellipse Position").setValue([cx, cy]); }
        return p;
    }
    function path(g, verts, closed) {
        var p = gv(g).addProperty("ADBE Vector Shape - Group"), s = new Shape();
        s.vertices = verts;
        s.closed = !!closed;
        p.property("ADBE Vector Shape").setValue(s);
        return p;
    }
    function fill(g, c, op) {
        var f = gv(g).addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(rgba(c));
        if (op !== undefined) { f.property("ADBE Vector Fill Opacity").setValue(op); }
        return f;
    }
    function stroke(g, c, w, op, dash) {
        var s = gv(g).addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(rgba(c));
        s.property("ADBE Vector Stroke Width").setValue(w);
        if (op !== undefined) { s.property("ADBE Vector Stroke Opacity").setValue(op); }
        if (dash) {
            var d = s.property("ADBE Vector Stroke Dashes");
            d.addProperty("ADBE Vector Stroke Dash 1").setValue(dash);
            d.addProperty("ADBE Vector Stroke Gap 1").setValue(dash);
        }
        try { s.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}
        return s;
    }
    function trimEnd(g) {
        return gv(g).addProperty("ADBE Vector Filter - Trim").property("ADBE Vector Trim End");
    }
    function star4(g, r) {    // четырёхлучевая звёздочка-маркер (7.5)
        var k = r * 0.2;
        return path(g, [[0, -r], [k, -k], [r, 0], [k, k], [0, r], [-k, k], [-r, 0], [-k, -k]], true);
    }

    // ---------- картинка (ч/б вырез с тенью) или заглушка ----------
    function image(comp, rel, x, y, maxW, maxH) {
        var item = rel ? importRel(rel, "images") : null, l;
        if (item) {
            l = comp.layers.add(item);
            var s = Math.min(maxW / item.width, maxH / item.height) * 100;
            P(l, "scale").setValue([s, s]);
            P(l, "pos").setValue([x, y]);
            fx(l, "ADBE Tint");                                   // ч/б
            var bc = fx(l, "ADBE Brightness & Contrast 2");
            bc.property(2).setValue(18);
            try { bc.property(3).setValue(0); } catch (e) {}
            shadow(l, 30, 20, 40, 135);
        } else {
            l = shapeLayer(comp, "ЗАГЛУШКА " + rel, x, y);
            var g = group(l, "ph");
            rect(g, maxW, maxH, 24);
            fill(g, [230, 230, 230]);
            stroke(g, S.grey_line, 3, 100, 12);
            var lab = text(comp, (rel || "image").split("/").pop(), "light", 26, S.grey_text);
            placeText(lab, x, y, 0);
        }
        return l;
    }

    // ---------- карточка S2 (8.3) ----------
    function lcg(seed) { var s = seed; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

    function card(comp, cx, cy, w, h, opts) {
        opts = opts || {};
        var dur = comp.duration, i, g, l;
        var c = shapeLayer(comp, "card", cx, cy);
        g = group(c, "card");
        rect(g, w, h, 32);
        fill(g, S.white);
        shadow(c, 35, 20, 60, 135);

        // тонкие окружности через всю карточку, медленно вращаются
        l = shapeLayer(comp, "circles", cx, cy);
        g = group(l, "c1"); ellipse(g, w * 0.9, h * 0.8, w * 0.08, -h * 0.05); stroke(g, S.grey_line, 2, 50);
        g = group(l, "c2"); ellipse(g, w * 1.1, w * 1.1, -w * 0.12, h * 0.12); stroke(g, S.grey_line, 1.5, 45);
        smooth(P(l, "rot"), 0, dur, 0, 12);

        // сетка 7×5 за объектом
        if (opts.grid !== false) {
            l = shapeLayer(comp, "grid", cx, opts.gridY || cy);
            var gw = w * 0.62, gh = gw * 5 / 7;
            g = group(l, "grid");
            for (i = 0; i <= 7; i++) { path(g, [[-gw / 2 + gw * i / 7, -gh / 2], [-gw / 2 + gw * i / 7, gh / 2]], false); }
            for (i = 0; i <= 5; i++) { path(g, [[-gw / 2, -gh / 2 + gh * i / 5], [gw / 2, -gh / 2 + gh * i / 5]], false); }
            stroke(g, S.grey_line, 0.75, 30);
        }
        // штрихкод вверху справа
        var rnd = lcg(Math.round(cx + cy + w)), x0 = cx + w / 2 - 190, y0 = cy - h / 2 + 44;
        l = shapeLayer(comp, "barcode", 0, 0);
        g = group(l, "bars");
        var bx = 0;
        while (bx < 140) {
            var bw = 1 + Math.floor(rnd() * 4);
            if (rnd() > 0.35) { rect(g, bw, 34, 0, x0 + bx + bw / 2, y0 + 17); }
            bx += bw + 1 + Math.floor(rnd() * 2);
        }
        fill(g, S.ink);
        // «QR» внизу слева — декор (21×21, псевдослучайный)
        if (opts.qr !== false) {
            l = shapeLayer(comp, "qr", 0, 0);
            g = group(l, "qr");
            var q = 3, qx = cx - w / 2 + 44, qy = cy + h / 2 - 44 - 21 * q, a, b;
            for (a = 0; a < 21; a++) {
                for (b = 0; b < 21; b++) {
                    var finder = (a < 7 && b < 7) || (a < 7 && b > 13) || (a > 13 && b < 7);
                    var on = finder ? (a % 6 === 0 || b % 6 === 0 || (a % 7 > 1 && a % 7 < 5 && b % 7 > 1 && b % 7 < 5) ||
                                       a === 20 || b === 20 || a === 14 || b === 14) : rnd() > 0.5;
                    if (on) { rect(g, q, q, 0, qx + b * q + q / 2, qy + a * q + q / 2); }
                }
            }
            fill(g, S.ink);
        }
        // уголки-кадрирование
        if (opts.brackets) {
            l = shapeLayer(comp, "brackets", cx, cy);
            g = group(l, "br");
            var m = 34, L = 50, hw = w / 2 - m, hh = h / 2 - m;
            path(g, [[-hw, -hh + L], [-hw, -hh], [-hw + L, -hh]]);
            path(g, [[hw - L, -hh], [hw, -hh], [hw, -hh + L]]);
            path(g, [[-hw, hh - L], [-hw, hh], [-hw + L, hh]]);
            path(g, [[hw - L, hh], [hw, hh], [hw, hh - L]]);
            stroke(g, S.ink, 3);
        }
        // осколки: 2 чёрных треугольника в противоположных углах, лёгкая хроматическая аберрация
        var sh = [
            { x: cx - w / 2, y: cy - h / 2, v: [[0, 0], [150, 0], [40, 26], [96, 150], [0, 96]], from: [-70, -70] },
            { x: cx + w / 2, y: cy + h / 2, v: [[0, 0], [-160, 0], [-44, -30], [-104, -160], [0, -104]], from: [70, 70] }
        ];
        for (i = 0; i < sh.length; i++) {
            var cols = [[200, 40, 40], [40, 160, 220], S.ink], offs = [[-3, 0], [3, 1], [0, 0]], ops = [55, 55, 100], k;
            for (k = 0; k < 3; k++) {
                l = shapeLayer(comp, "shard" + (i + 1) + (k < 2 ? "_ca" : ""), sh[i].x + offs[k][0], sh[i].y + offs[k][1]);
                g = group(l, "s");
                path(g, sh[i].v, true);
                fill(g, cols[k], ops[k]);
                var p0 = P(l, "pos").value;
                anim(P(l, "pos"), S.lead_in_delay, S.lead_in_delay + S.card_in,
                     [p0[0] + sh[i].from[0], p0[1] + sh[i].from[1]], p0);
            }
        }
        return c;
    }

    function insertComp(ins) {
        var dur = Math.max(0.5, ins.t_out - ins.t_in) + FR * 2;
        var comp = inFolder(app.project.items.addComp(ins.id + "_" + ins.template, W, H, 1, dur, FPS));
        comp.motionBlur = true; comp.shutterAngle = 180; comp.shutterPhase = -90;
        return comp;
    }
    function rel(ins, t) { return Math.max(0, t - ins.t_in); }   // время клипа → время вставки

    // ---------- шаблоны вставок (9.3) ----------
    var BUILD = {};
    BUILD.V5_object = function (comp, ins) {
        var cx = W / 2, cy = 655, t0 = 0.12;
        card(comp, cx, cy, 860, 920, { gridY: 560 });
        var ring = shapeLayer(comp, "dashed circle", cx, 560), g = group(ring, "r");
        ellipse(g, 520, 520); stroke(g, S.ink, 2, 70, 8);
        smooth(P(ring, "rot"), 0, comp.duration, 0, 360 * comp.duration / 9);
        var obj = image(comp, ins.image, cx, 560, 520, 400);
        anim(P(obj, "scale"), t0, t0 + 10 / 30, [P(obj, "scale").value[0] * 1.1, P(obj, "scale").value[1] * 1.1], P(obj, "scale").value);
        smooth(P(obj, "rot"), t0, comp.duration, -3, 3);
        var hero = placeText(text(comp, ins.hero, "display", 150, S.ink, null, -15), cx, 930, 0);
        T2(hero, t0 + 0.2);
        shadow(hero, 28, 25, 50, 135);
        var lead = placeText(text(comp, ins.lead_in, "light", 38, S.ink), cx, 838, 0);
        T1(lead, t0 + 0.2 + S.lead_in_delay, 838);
        if (ins.small) {
            var sm = placeText(text(comp, ins.small, "light", 24, S.grey_text, null, 10), cx, 1030, 0);
            T1(sm, t0 + 0.55, 1030);
        }
    };
    function numberLayout(comp, ins, isCounter) {
        var cx = W / 2, cy = 655, t0 = 0.1;
        card(comp, cx, cy, 860, 920, { gridY: 820 });
        if (ins.decor_image) {                                   // монета-декор за объектом (как в референсе)
            var coin = image(comp, ins.decor_image, cx + 300, 770, 190, 190);
            anim(P(coin, "op"), t0 + 0.3, t0 + 0.6, 0, 100);
            smooth(P(coin, "rot"), 0, comp.duration, -15, 20);
        }
        var obj = image(comp, ins.image, cx, 840, 560, 300);
        anim(P(obj, "op"), t0 + 0.2, t0 + 0.5, 0, 100);
        var lead = placeText(text(comp, ins.lead_in, "light", 38, S.ink), cx, 330, 0);
        T1(lead, t0, 330);
        var heroTxt = isCounter ? (ins.prefix + ins.count_to + ins.suffix) : ins.hero;
        var hero = text(comp, heroTxt, "display", isCounter ? 210 : 260, S.ink, null, -20);
        placeText(hero, cx, 520, 0);
        shadow(hero, 28, 25, 50, 135);
        if (isCounter) {
            var a = rel(ins, ins.count_t[0]), b = rel(ins, ins.count_t[1]);
            hero.property("ADBE Text Properties").property("ADBE Text Document").expression =
                "var t0=" + a + ",t1=" + b + ";var u=Math.min(1,Math.max(0,(time-t0)/(t1-t0)));u=1-Math.pow(1-u,3);" +
                "'" + ins.prefix + "'+Math.round(" + ins.count_to + "*u)+'" + ins.suffix + "'";
            anim(P(hero, "op"), Math.max(0, a - 0.25), a, 0, 100);
            anim(P(hero, "scale"), b, b + 6 / 30, [104, 104], [100, 100]);   // удар масштаба (7.4)
        } else {
            T2(hero, t0 + 0.15);
        }
        if (ins.sub) {
            var sub = placeText(text(comp, ins.sub, "medium", 38, S.ink), cx, 1035, 0);
            T1(sub, t0 + 0.35, 1035);
        }
    }
    BUILD.V1_number = function (comp, ins) { numberLayout(comp, ins, false); };
    BUILD.V1_counter = function (comp, ins) { numberLayout(comp, ins, true); };

    BUILD.V8_chart = function (comp, ins) {
        var cx = W / 2, cy = 655, t0 = 0.1;
        card(comp, cx, cy, 860, 920, { gridY: 590 });
        var lead = placeText(text(comp, ins.lead_in, "light", 38, S.ink), cx, 300, 0);
        T1(lead, t0, 300);
        var ch = shapeLayer(comp, "chart", cx, 590), g = group(ch, "axes");
        path(g, [[-280, -170], [-280, 190], [300, 190]]);
        stroke(g, S.ink, 3);
        g = group(ch, "line");
        path(g, [[-270, 170], [-180, 120], [-100, 30], [-20, -60], [60, -105], [140, -118], [220, -121], [290, -122]]);
        stroke(g, S.ink, 7);
        anim(trimEnd(g), t0 + 0.2, t0 + 1.1, 0, 100);
        g = group(ch, "dash");
        path(g, [[-280, -122], [300, -122]]);
        stroke(g, S.grey_text, 2, 80, 10);
        anim(P(ch, "op"), t0, t0 + 0.25, 0, 100);
        var hero = placeText(text(comp, ins.hero, "display", 170, S.ink, null, -15), cx, 900, 0);
        T2(hero, t0 + 0.6);
        shadow(hero, 28, 25, 50, 135);
        if (ins.small) {
            var sm = placeText(text(comp, ins.small, "light", 24, S.grey_text, null, 10), cx, 1025, 0);
            T1(sm, t0 + 0.8, 1025);
        }
    };

    BUILD.V3_list = function (comp, ins) {
        var cx = W / 2, t0 = 0.08, i;
        card(comp, cx, 500, 640, 560, { grid: false, qr: false });
        var obj = image(comp, ins.image, cx, 500, 420, 400);
        anim(P(obj, "scale"), t0, t0 + 10 / 30, [P(obj, "scale").value[0] * 1.1, P(obj, "scale").value[1] * 1.1], P(obj, "scale").value);
        for (i = 0; i < ins.items.length; i++) {
            var t = rel(ins, ins.items[i].t), y = 880 + i * 92, x = 400;
            var st = shapeLayer(comp, "star" + (i + 1), x - 44, y), g = group(st, "s");
            star4(g, 20); fill(g, S.paper);
            anim(P(st, "scale"), Math.max(0, t - 2 * FR), t + 6 * FR, [0, 0], [100, 100]);
            anim(P(st, "rot"), Math.max(0, t - 2 * FR), t + 6 * FR, 45, 0);
            var it = text(comp, ins.items[i].text, "medium", 54, S.paper, ParagraphJustification.LEFT_JUSTIFY);
            var r = it.sourceRectAtTime(0, false);
            P(it, "anchor").setValue([r.left, r.top + r.height / 2]);
            P(it, "pos").setValue([x, y]);
            shadow(it, 60, 4, 10);
            T1(it, t, y, 16, 0);
            var px = P(it, "pos");     // T5: сдвиг по X −20 → 0
            px.removeKey(px.numKeys); px.removeKey(px.numKeys);
            anim(px, t, t + S.T1, [x - 20, y], [x, y]);
        }
    };

    BUILD.V9_compare = function (comp, ins) {
        var sides = [{ d: ins.left, x: 290, t: 0.08 }, { d: ins.right, x: 790, t: rel(ins, ins.right.t || ins.t_in + 0.5) }], i;
        for (i = 0; i < 2; i++) {
            var s = sides[i], sub = inFolder(app.project.items.addComp(ins.id + "_" + (i ? "right" : "left"), W, H, 1, comp.duration, FPS));
            card(sub, s.x, 640, 470, 780, { grid: false, qr: i === 1 });
            image(sub, s.d.image, s.x, 520, 330, 330);
            var lab = placeText(text(sub, s.d.label, "medium", 36, S.ink), s.x, 770, 0);
            var val = placeText(text(sub, s.d.value, "display", 130, S.ink, null, -15), s.x, 890, 0);
            shadow(val, 28, 20, 40, 135);
            var l = comp.layers.add(sub);
            l.startTime = s.t;
            l.motionBlur = true;
            anim(P(l, "pos"), s.t, s.t + S.card_in, [W / 2 + (i ? 140 : -140), H / 2], [W / 2, H / 2]);
            anim(P(l, "op"), s.t, s.t + S.card_in * 0.6, 0, 100);
            anim(blurFx(l), s.t, s.t + S.card_in, 30, 0);
            T2(val, 0.25);
        }
        // линия-шторка между карточками (V9)
        var ln = shapeLayer(comp, "divider", W / 2, 640), g = group(ln, "l");
        path(g, [[0, -420], [0, 420]]);
        stroke(g, S.paper, 3, 80);
        var te = trimEnd(g), tt = sides[1].t;
        anim(te, tt, tt + 15 / 30, 0, 100);
        var vs = placeText(text(comp, "vs", "medium", 34, S.paper), W / 2, 1100, 0);
        T1(vs, tt + 0.1, 1100);
    };

    BUILD.V2_thesis = function (comp, ins) {
        var cx = W / 2, cy = 655, t0 = 0.1;
        card(comp, cx, cy, 860, 920, { brackets: true, qr: false, gridY: 700 });
        var lead = placeText(text(comp, ins.lead_in, "light", 38, S.ink), cx, 318, 0);
        var hero = placeText(text(comp, ins.hero, "display", 200, S.ink, null, -15), cx, 440, 0);
        shadow(hero, 28, 25, 50, 135);
        T2(hero, t0);
        T1(lead, t0 + S.lead_in_delay, 318);
        var ring = shapeLayer(comp, "dashed circle", cx, 730), g = group(ring, "r");
        ellipse(g, 400, 400); stroke(g, S.ink, 2, 70, 8);
        smooth(P(ring, "rot"), 0, comp.duration, 0, 360 * comp.duration / 9);
        var obj = image(comp, ins.image, cx, 730, 330, 330);
        anim(P(obj, "scale"), t0 + 0.15, t0 + 0.15 + 10 / 30, [P(obj, "scale").value[0] * 1.1, P(obj, "scale").value[1] * 1.1], P(obj, "scale").value);
        if (ins.small) {
            var sm = placeText(text(comp, ins.small, "light", 24, S.grey_text, null, 10), cx, 1010, 0);
            T1(sm, t0 + 0.45, 1010);
        }
    };

    // ============ 1. SPEAKER ============
    var src = importRel(C.source, "other");
    if (!src) { alert("Нет исходника: " + projFile(C.source).fsName); app.endUndoGroup(); return; }
    var speaker = inFolder(app.project.items.addComp("SPEAKER", W, H, 1, C.duration, FPS));
    var i, j;
    for (i = 0; i < C.pieces.length; i++) {
        var pc = C.pieces[i], l = speaker.layers.add(src);
        l.name = "piece " + (i + 1) + "  src " + pc.src_in.toFixed(2) + "–" + pc.src_out.toFixed(2);
        l.startTime = pc.t_in - pc.src_in;
        l.inPoint = pc.t_in;
        l.outPoint = pc.t_out;
        P(l, "anchor").setValue(pc.anchor);
        P(l, "pos").setValue(pc.position);
        smooth(P(l, "scale"), pc.t_in, pc.t_out, [pc.scale_in, pc.scale_in], [pc.scale_out, pc.scale_out]);
        // фейд звука 2 кадра на склейках (3.2)
        try {
            var al = l.property("ADBE Audio Group").property("ADBE Audio Levels");
            al.setValueAtTime(pc.t_in, [-48, -48]); al.setValueAtTime(pc.t_in + 2 * FR, [0, 0]);
            al.setValueAtTime(pc.t_out - 2 * FR, [0, 0]); al.setValueAtTime(pc.t_out, [-48, -48]);
        } catch (e) {}
    }

    // ============ 2. SUBTITLES ============
    var subs = inFolder(app.project.items.addComp("SUBTITLES", W, H, 1, C.duration, FPS));
    var SY = S.sub_y, SS = S.sub_size;
    for (i = C.subtitles.length - 1; i >= 0; i--) {
        var grp = C.subtitles[i], layers = [], widths = [], total = 0, space = SS * 0.28;
        for (j = 0; j < grp.words.length; j++) {
            var w = grp.words[j], acc = !!w.accent;
            var tl = text(subs, w.w, acc ? "accent" : "sub", acc ? Math.round(SS * S.accent_scale) : SS, acc ? S.accent : S.paper,
                          ParagraphJustification.LEFT_JUSTIFY, acc ? 0 : -5);
            var r = tl.sourceRectAtTime(0, false);
            P(tl, "anchor").setValue([r.left, r.top + r.height / 2]);
            layers.push(tl); widths.push(r.width); total += r.width;
        }
        total += space * (grp.words.length - 1);
        var x = W / 2 - total / 2;
        for (j = 0; j < layers.length; j++) {
            var lw = layers[j];
            P(lw, "pos").setValue([x, SY]);
            x += widths[j] + space;
            lw.inPoint = grp.words[j].t;
            lw.outPoint = grp.t_out;
            shadow(lw, 85, 4, 11, 180);
            T1(lw, grp.words[j].t, SY);
            lw.motionBlur = true;
        }
    }
    subs.motionBlur = true; subs.shutterAngle = 180; subs.shutterPhase = -90;

    // ============ 3. REEL ============
    var reel = inFolder(app.project.items.addComp("REEL_" + C.name, W, H, 1, C.duration, FPS));
    reel.motionBlur = true; reel.shutterAngle = 180; reel.shutterPhase = -90;
    reel.bgColor = [0.07, 0.07, 0.07];

    // спикер + цвет (4.3): контраст +12, вибранс +8 — только на спикере
    var spk = reel.layers.add(speaker);
    spk.name = "SPEAKER (цвет 4.3)";
    var bc = fx(spk, "ADBE Brightness & Contrast 2");
    bc.property(2).setValue(12);
    try { bc.property(3).setValue(0); } catch (e) {}
    try { fx(spk, "ADBE Vibrance").property(1).setValue(8); } catch (e) {}

    // вставки: расфокус спикера под карточкой + сама карточка
    var markers = [];
    for (i = 0; i < C.inserts.length; i++) {
        var ins = C.inserts[i];
        if (!BUILD[ins.template]) { missing.other.push("нет шаблона " + ins.template); continue; }
        var ic = insertComp(ins);
        BUILD[ins.template](ic, ins);

        var bg = reel.layers.addSolid([0, 0, 0], "defocus " + ins.id, W, H, 1, C.duration);
        bg.adjustmentLayer = true;
        var d = S.defocus;
        bg.inPoint = Math.max(0, ins.t_in - d);
        bg.outPoint = Math.min(C.duration, ins.t_out + d);
        var bl = blurFx(bg);
        anim(bl, ins.t_in - d, ins.t_in, 0, 30);
        anim(bl, ins.t_out, ins.t_out + d, 30, 0);
        var br = fx(bg, "ADBE Brightness & Contrast 2").property(1);
        anim(br, ins.t_in - d, ins.t_in, 0, -60);
        anim(br, ins.t_out, ins.t_out + d, -60, 0);

        var il = reel.layers.add(ic);
        il.startTime = ins.t_in;
        il.outPoint = Math.min(C.duration, ins.t_out);
        il.motionBlur = true;
        var ib = blurFx(il);
        anim(ib, ins.t_in, ins.t_in + S.card_in, 30, 0);                           // вход из расфокуса
        anim(P(il, "scale"), ins.t_in, ins.t_in + S.card_in, [94, 94], [100, 100]);
        anim(P(il, "op"), ins.t_in, ins.t_in + S.card_in * 0.5, 0, 100);
        var te = ins.t_out - S.T6;                                                   // выход T6
        anim(P(il, "op"), te, ins.t_out, 100, 0);
        anim(ib, te, ins.t_out, 0, 10);
        anim(P(il, "scale"), te, ins.t_out, [100, 100], [103, 103]);
        markers.push([ins.t_in, ins.id + " " + ins.template]);
    }

    // заголовок-хук (0, 5.2): Coolvetica 130 px
    if (C.headline) {
        var hl = text(reel, C.headline.lines.join("\r"), "display", S.headline_size, S.paper, null, -10, S.headline_size * 0.95);
        placeText(hl, W / 2, C.headline.y, 0);
        shadow(hl, 60, 6, 18, 180);
        T2(hl, C.headline.from);
        T6(hl, C.headline.to);
        hl.outPoint = C.headline.to + S.T6 + FR;
        hl.motionBlur = true;
    }

    var subL = reel.layers.add(subs);
    subL.name = "SUBTITLES";
    subL.moveToBeginning();

    // SFX (12.4): варианты по кругу, один и тот же подряд не ставим
    var sfxFolder = new Folder(PROJ.fsName + "/assets/sfx"), pools = {}, lastUsed = {};
    function pool(kind) {
        if (pools[kind] === undefined) {
            pools[kind] = sfxFolder.exists ? sfxFolder.getFiles(function (f) {
                return f instanceof File && f.name.toLowerCase().indexOf(kind + "_") === 0 && /\.(wav|mp3|aif|aiff|m4a)$/i.test(f.name);
            }) : [];
        }
        return pools[kind];
    }
    for (i = 0; i < C.sfx.length; i++) {
        var ev = C.sfx[i], files = pool(ev.kind);
        if (!files.length) { missing.sfx[ev.kind] = true; markers.push([ev.t, "SFX " + ev.kind]); continue; }
        var idx = ((lastUsed[ev.kind] === undefined ? -1 : lastUsed[ev.kind]) + 1) % files.length;
        lastUsed[ev.kind] = idx;
        var it = importRel("assets/sfx/" + files[idx].name, "sfx");
        var sl = reel.layers.add(it);
        sl.startTime = ev.t;
        sl.name = "SFX " + ev.kind;
        try { sl.property("ADBE Audio Group").property("ADBE Audio Levels").setValue([S.sfx_db, S.sfx_db]); } catch (e) {}
        sl.moveToEnd();
    }
    // музыка (12.3)
    var mf = new Folder(PROJ.fsName + "/" + C.music), mfiles = mf.exists ? mf.getFiles(/\.(wav|mp3|aif|aiff|m4a)$/i) : [];
    if (mfiles.length) {
        var mi = importRel(C.music + "/" + mfiles[0].name, "other"), ml = reel.layers.add(mi);
        ml.name = "MUSIC";
        var ma = ml.property("ADBE Audio Group").property("ADBE Audio Levels");
        ma.setValueAtTime(0, [S.music_db, S.music_db]);
        ma.setValueAtTime(C.duration - 1, [S.music_db, S.music_db]);
        ma.setValueAtTime(C.duration, [-60, -60]);
        ml.moveToEnd();
    }

    // маркеры
    for (i = 0; i < markers.length; i++) {
        try { reel.markerProperty.setValueAtTime(markers[i][0], new MarkerValue(markers[i][1])); } catch (e) {}
    }

    // очередь рендера (экспорт 2): H.264; громкость −14 LUFS — после рендера (README проекта)
    try {
        var rq = app.project.renderQueue.items.add(reel);
        var om = rq.outputModule(1);
        try { om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); } catch (e) {}
        var rd = new Folder(PROJ.fsName + "/renders"); if (!rd.exists) { rd.create(); }
        om.file = new File(rd.fsName + "/REEL_" + C.name);
    } catch (e) { missing.other.push("очередь рендера: " + e); }

    reel.openInViewer();
    app.endUndoGroup();

    try { app.project.save(new File(PROJ.fsName + "/ae/" + C.name + ".aep")); } catch (e) {}

    // отчёт
    function keys(o) { var a = [], k; for (k in o) { if (o.hasOwnProperty(k)) { a.push(k); } } return a; }
    var msg = "Готово: REEL_" + C.name + " (" + C.duration.toFixed(1) + " с)\n";
    var mfnt = keys(missing.fonts), mimg = keys(missing.images), msfx = keys(missing.sfx);
    if (mfnt.length) { msg += "\nНет шрифтов (подставлены): " + mfnt.join(", "); }
    if (mimg.length) { msg += "\nНет картинок (заглушки): " + mimg.join(", "); }
    if (msfx.length) { msg += "\nНет SFX (маркеры на таймлайне): " + msfx.join(", "); }
    if (missing.other.length) { msg += "\n" + missing.other.join("\n"); }
    msg += "\n\nПроверка перед экспортом: check_face.py (гайд, раздел 14).";
    alert(msg);
})();
