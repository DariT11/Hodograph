const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const analysisCanvas = document.getElementById("analysisCanvas");
const actx = analysisCanvas.getContext("2d");

function setupHiDPICanvas(c, context) {
    const dpr = window.devicePixelRatio || 1;

    const cssW = c.width;
    const cssH = c.height;

    c.style.width = cssW + "px";
    c.style.height = cssH + "px";

    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.lineJoin = "round";
    context.lineCap = "round";
}

setupHiDPICanvas(canvas, ctx);
setupHiDPICanvas(analysisCanvas, actx);

const HIT_R = 10;
const PT_R = 5;

const DEFAULT_SEGMENTS = [[
    { x: 100, y: 300 },
    { x: 300, y: 100 },
    { x: 500, y: 300 }
]];

let segments = JSON.parse(JSON.stringify(DEFAULT_SEGMENTS));

let t = 0;
let animate = false;
let speed = 1;
let showCasteljau = true;
let showHodograph = true;

let selectedPoint = null;

document.getElementById("chkAnimate").onchange = (e) => {
    animate = e.target.checked;
    if (animate) requestAnimationFrame(loop);
    draw();
};

document.getElementById("animSpeed").oninput = (e) => {
    speed = parseFloat(e.target.value);
    document.getElementById("lblSpeed").textContent = speed;
};

document.getElementById("chkShowCasteljau").onchange = (e) => {
    showCasteljau = e.target.checked;
    draw();
};

document.getElementById("chkShowHodograph").onchange = (e) => {
    showHodograph = e.target.checked;
    draw();
};

document.getElementById("btnAddSegment").onclick = () => {
    segments.push([
        { x: 150, y: 350 },
        { x: 350, y: 150 },
        { x: 600, y: 350 }
    ]);
    draw();
};

document.getElementById("btnRemoveSegment").onclick = () => {
    if (segments.length > 1) segments.pop();
    draw();
};

document.getElementById("btnReset").onclick = () => {
    segments = JSON.parse(JSON.stringify(DEFAULT_SEGMENTS));
    t = 0;
    animate = false;
    const chk = document.getElementById("chkAnimate");
    if (chk) chk.checked = false;
    draw();
};


canvas.onmousedown = (e) => {
    const { x, y } = mousePos(e);


    if (e.button === 0 && e.shiftKey) {
        addControlPoint(x, y);
        draw();
        return;
    }

    if (e.button === 2) {
        removePoint(x, y);
        draw();
        return;
    }

    selectedPoint = findClosestPoint(x, y);
};

canvas.onmousemove = (e) => {
    if (selectedPoint) {
        const { x, y } = mousePos(e);
        selectedPoint.x = x;
        selectedPoint.y = y;
        draw();
    }
};

canvas.onmouseup = () => selectedPoint = null;
canvas.onmouseleave = () => selectedPoint = null;
canvas.oncontextmenu = (e) => e.preventDefault();

function mousePos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function dist(p, x, y) { return Math.hypot(p.x - x, p.y - y); }

function lerp(a, b, t) {
    return { x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y };
}

function findClosestPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const seg of segments) {
        for (const p of seg) {
            const d = dist(p, x, y);
            if (d < bestD) { bestD = d; best = p; }
        }
    }
    return bestD <= HIT_R ? best : null;
}

function addControlPoint(x, y) {
    let bestSeg = 0;
    let bestD = Infinity;
    for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        for (let i = 0; i < seg.length - 1; i++) {
            const d = pointToSegmentDistance({ x, y }, seg[i], seg[i + 1]);
            if (d < bestD) { bestD = d; bestSeg = si; }
        }
        if (seg.length === 1) {
            const d = dist(seg[0], x, y);
            if (d < bestD) { bestD = d; bestSeg = si; }
        }
    }

    const seg = segments[bestSeg];
    if (seg.length === 0) {
        seg.push({ x, y });
        return;
    }

    let idx = 0;
    let bestP = Infinity;
    for (let i = 0; i < seg.length; i++) {
        const d = dist(seg[i], x, y);
        if (d < bestP) { bestP = d; idx = i; }
    }
    seg.splice(idx + 1, 0, { x, y });
}

function removePoint(x, y) {
    for (const seg of segments) {
        if (seg.length <= 2) continue; 
        for (let i = 0; i < seg.length; i++) {
            if (dist(seg[i], x, y) < HIT_R) {
                seg.splice(i, 1);
                return;
            }
        }
    }
}

function pointToSegmentDistance(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const wx = p.x - a.x, wy = p.y - a.y;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
    const t = c1 / c2;
    const proj = { x: a.x + t * vx, y: a.y + t * vy };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
}

function deCasteljau(points, t) {
    let tmp = points.map(p => ({ ...p }));
    for (let r = 1; r < points.length; r++) {
        for (let i = 0; i < points.length - r; i++) {
            tmp[i] = lerp(tmp[i], tmp[i + 1], t);
        }
    }
    return tmp[0];
}

function deCasteljauLevels(points, t) {
    let levels = [];
    let cur = points.map(p => ({ ...p }));
    levels.push(cur);
    for (let r = 1; r < points.length; r++) {
        let next = [];
        for (let i = 0; i < cur.length - 1; i++) {
            next.push(lerp(cur[i], cur[i + 1], t));
        }
        levels.push(next);
        cur = next;
    }
    return levels;
}

function hodographControlPoints(points) {
    const n = points.length - 1;
    if (n <= 0) return [];
    let q = [];
    for (let i = 0; i < n; i++) {
        q.push({
            x: n * (points[i + 1].x - points[i].x),
            y: n * (points[i + 1].y - points[i].y),
        });
    }
    return q;
}

function bern(n, i, t) {
    return binom(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

function binom(n, k) {
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n + 1 - i) / i;
    return r;
}

function derivative(points, t) {
    let n = points.length - 1;
    if (n <= 0) return { x: 0, y: 0 };
    let dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        dx += n * (points[i + 1].x - points[i].x) * bern(n - 1, i, t);
        dy += n * (points[i + 1].y - points[i].y) * bern(n - 1, i, t);
    }
    return { x: dx, y: dy };
}

function secondDerivative(points, t) {
    let n = points.length - 1;
    if (n <= 1) return { x: 0, y: 0 };
    let dx = 0, dy = 0;
    for (let i = 0; i < n - 1; i++) {
        dx += n * (n - 1) * (points[i + 2].x - 2 * points[i + 1].x + points[i].x) * bern(n - 2, i, t);
        dy += n * (n - 1) * (points[i + 2].y - 2 * points[i + 1].y + points[i].y) * bern(n - 2, i, t);
    }
    return { x: dx, y: dy };
}

function curvatureAt(points, t) {
    const d = derivative(points, t);
    const dd = secondDerivative(points, t);
    const v = Math.hypot(d.x, d.y);
    if (v < 1e-9) return 0;
    return Math.abs(d.x * dd.y - d.y * dd.x) / Math.pow(v, 3);
}

function drawPoint(context, p, r = PT_R) {
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.fill();
}

function drawArrow(context, from, to) {
    const headLen = 8;
    const dx = to.x - from.x, dy = to.y - from.y;
    const a = Math.atan2(dy, dx);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(to.x - headLen * Math.cos(a - Math.PI / 6), to.y - headLen * Math.sin(a - Math.PI / 6));
    context.lineTo(to.x - headLen * Math.cos(a + Math.PI / 6), to.y - headLen * Math.sin(a + Math.PI / 6));
    context.closePath();
    context.fill();
}

function drawCasteljau(levels) {
    for (let r = 0; r < levels.length - 1; r++) {
        const lvl = levels[r];
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < lvl.length; i++) {
            if (i === 0) ctx.moveTo(lvl[i].x, lvl[i].y);
            else ctx.lineTo(lvl[i].x, lvl[i].y);
        }
        ctx.stroke();

        ctx.fillStyle = "rgba(0,0,0,0.55)";
        for (const p of lvl) drawPoint(ctx, p, 3.5);
    }
    const last = levels[levels.length - 1][0];
    ctx.fillStyle = "rgba(255,0,0,0.85)";
    drawPoint(ctx, last, 5.5);
}

function approximateLength(seg, steps = 200) {
    let L = 0;
    let prev = deCasteljau(seg, 0);
    for (let i = 1; i <= steps; i++) {
        const tt = i / steps;
        const p = deCasteljau(seg, tt);
        L += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
    }
    return L;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let speeds = [];
    let curvs = [];

    const seg0 = segments[0];
    const pAtT = (seg0 && seg0.length >= 2) ? deCasteljau(seg0, t) : { x: 0, y: 0 };
    const dAtT = (seg0 && seg0.length >= 2) ? derivative(seg0, t) : { x: 0, y: 0 };
    const vAtT = Math.hypot(dAtT.x, dAtT.y);
    const kAtT = (seg0 && seg0.length >= 2) ? curvatureAt(seg0, t) : 0;

    let totalLength = 0;
    for (const seg of segments) if (seg.length >= 2) totalLength += approximateLength(seg);

    document.getElementById("infoT").textContent = `t = ${t.toFixed(2)}`;
    document.getElementById("infoLength").textContent = `Length ≈ ${totalLength.toFixed(1)} px`;
    document.getElementById("infoCurvature").textContent = `Curvature ≈ ${kAtT.toExponential(2)}`;

    for (const seg of segments) {
        if (seg.length < 2) continue;
       
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].y);
        for (const p of seg) ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.fillStyle = "black";
        for (const p of seg) drawPoint(ctx, p, PT_R);

        ctx.strokeStyle = "red";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let prev = deCasteljau(seg, 0);
        ctx.moveTo(prev.x, prev.y);

        const STEPS = 200;
        for (let i = 1; i <= STEPS; i++) {
            const tt = i / STEPS;
            const p = deCasteljau(seg, tt);
            ctx.lineTo(p.x, p.y);

            const d = derivative(seg, tt);
            const dd = secondDerivative(seg, tt);
            const sp = Math.hypot(d.x, d.y);
            const curv = sp < 1e-9 ? 0 : Math.abs(d.x * dd.y - d.y * dd.x) / Math.pow(sp, 3);
            speeds.push(sp);
            curvs.push(curv);

            prev = p;
        }
        ctx.stroke();

        if (showHodograph && seg.length >= 2) {
            const hCtrl = hodographControlPoints(seg);
            if (hCtrl.length >= 2) {
                ctx.strokeStyle = "rgba(0,0,255,0.75)";
                ctx.lineWidth = 1.75;
                ctx.beginPath();
                let hpPrev = deCasteljau(hCtrl, 0);
            
                const offset = { x: 80, y: 80 };
                ctx.moveTo(hpPrev.x + offset.x, hpPrev.y + offset.y);
                for (let i = 1; i <= STEPS; i++) {
                    const tt = i / STEPS;
                    const hp = deCasteljau(hCtrl, tt);
                    ctx.lineTo(hp.x + offset.x, hp.y + offset.y);
                }
                ctx.stroke();

            
                const scale = 0.15; 
                const to = { x: pAtT.x + dAtT.x * scale, y: pAtT.y + dAtT.y * scale };
                ctx.strokeStyle = "rgba(0,120,255,0.9)";
                ctx.fillStyle = "rgba(0,120,255,0.9)";
                ctx.lineWidth = 2;
                drawArrow(ctx, pAtT, to);

                ctx.fillStyle = "rgba(0,0,255,0.85)";
                drawPoint(ctx, { x: offset.x, y: offset.y }, 3.5);
                ctx.font = "12px Arial";
                ctx.fillText("Hodograph (B'(t))", offset.x + 10, offset.y - 8);
            }
        }

        if (showCasteljau) {
            const levels = deCasteljauLevels(seg, t);
            drawCasteljau(levels);
        }
    }

    drawAnalysis(speeds, curvs);
}

function drawAnalysis(speedArr, curvArr) {
    actx.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);

    if (speedArr.length === 0 || curvArr.length === 0) return;

    const maxS = Math.max(...speedArr);
    const maxC = Math.max(...curvArr);

    actx.strokeStyle = "rgba(0,0,0,0.2)";
    actx.lineWidth = 1;
    actx.beginPath();
    actx.moveTo(30, 10);
    actx.lineTo(30, analysisCanvas.height - 20);
    actx.lineTo(analysisCanvas.width - 10, analysisCanvas.height - 20);
    actx.stroke();

    actx.strokeStyle = "blue";
    actx.lineWidth = 2;
    actx.beginPath();
    speedArr.forEach((v, i) => {
        const x = 30 + i * (analysisCanvas.width - 40) / (speedArr.length - 1);
        const y = (analysisCanvas.height - 20) - (maxS < 1e-9 ? 0 : (v / maxS) * (analysisCanvas.height - 40));
        if (i === 0) actx.moveTo(x, y);
        else actx.lineTo(x, y);
    });
    actx.stroke();
    actx.fillStyle = "blue";
    actx.font = "12px Arial";
    actx.fillText("Speed |B'(t)|", 40, 20);

    actx.strokeStyle = "green";
    actx.lineWidth = 2;
    actx.beginPath();
    curvArr.forEach((v, i) => {
        const x = 30 + i * (analysisCanvas.width - 40) / (curvArr.length - 1);
        const y = (analysisCanvas.height - 20) - (maxC < 1e-12 ? 0 : (v / maxC) * (analysisCanvas.height - 40));
        if (i === 0) actx.moveTo(x, y);
        else actx.lineTo(x, y);
    });
    actx.stroke();
    actx.fillStyle = "green";
    actx.fillText("Curvature κ(t)", 40, 38);
}


function loop() {
    if (!animate) return;
    t += 0.002 * speed;
    if (t > 1) t = 0;
    draw();
    requestAnimationFrame(loop);
}

window.addEventListener("resize", () => 
{
    setupHiDPICanvas(canvas, ctx);
    setupHiDPICanvas(analysisCanvas, actx);
    draw();
});

draw();
