let canvas, ctx;
let segments = [];
let initialSegment = [{x:100,y:300},{x:300,y:100},{x:500,y:300}];
let offsetXs = [], offsetYs = [];
let selectedPoint = null;
let draggingHodoIndex = -1, startDragX = 0, startDragY = 0;
let currentMethod = "casteljau";
let showDerivative = true;
let hodographScale = 1.0;
let showCasteljauSteps = false;
let isAnimating = false, animSpeed = 1, animT = 0;
let sliderT, infoLength, infoTValue, infoCurvature;

window.onload = function() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    sliderT = document.getElementById("sliderT");
    infoLength = document.getElementById("infoLength");
    infoTValue = document.getElementById("infoTValue");
    infoCurvature = document.getElementById("infoCurvature");

    canvas.onmousedown = onCanvasMouseDown;
    canvas.onmousemove = onCanvasMouseMove;
    canvas.onmouseup = onCanvasMouseUp;
    canvas.oncontextmenu = e => e.preventDefault();

    // Resize
    document.getElementById("btnResizeCanvas").onclick = () => {
        let w = parseInt(document.getElementById("inputWidth").value);
        let h = parseInt(document.getElementById("inputHeight").value);
        canvas.width = w; canvas.height = h;
        draw();
    };

    document.getElementById("chkShowDerivative").onchange = e => { showDerivative = e.target.checked; draw(); };
    document.getElementById("hodographScale").oninput = e => {
        hodographScale = parseFloat(e.target.value);
        document.getElementById("lblHodoScale").textContent = hodographScale.toFixed(1);
        draw();
    };
    document.getElementById("chkShowCasteljau").onchange = e => { showCasteljauSteps = e.target.checked; draw(); };
    document.getElementById("chkAnimate").onchange = e => { isAnimating = e.target.checked; if(isAnimating) requestAnimationFrame(animationLoop); };
    document.getElementById("animSpeed").oninput = e => { animSpeed=parseFloat(e.target.value); document.getElementById("lblAnimSpeed").textContent = animSpeed; };

    document.getElementById("btnAddSegment").onclick = () => {
        segments.push([{x:150,y:400},{x:350,y:200},{x:600,y:400}]);
        offsetXs.push(0); offsetYs.push(0);
        draw();
    };
    document.getElementById("btnRemoveSegment").onclick = () => { if(segments.length>0){segments.pop();offsetXs.pop();offsetYs.pop();draw();} };
    document.getElementById("btnExportSVG").onclick = () => exportToSVG();

    sliderT.oninput = () => { isAnimating=false; animT=parseFloat(sliderT.value); draw(); };

    segments.push(initialSegment.map(p=>({x:p.x,y:p.y})));
    offsetXs=[0]; offsetYs=[0];
    draw();
};

function onCanvasMouseDown(e){
    const {x,y} = getMousePos(e);
    for(let s=0;s<segments.length;s++){
        let derivPts=computeHodographPoints(segments[s],hodographScale);
        if(derivPts.length<1) continue;
        let sumX=0,sumY=0;
        for(let p of derivPts){sumX+=offsetXs[s]+p.x;sumY+=offsetYs[s]-p.y;}
        let midX=sumX/derivPts.length, midY=sumY/derivPts.length;
        if((x-midX)**2+(y-midY)**2<64){draggingHodoIndex=s;startDragX=x;startDragY=y;return;}
    }

    if(e.button===2){removeClosestPoint(x,y); draw(); return;}
    if(e.shiftKey){segments[segments.length-1].push({x,y}); draw(); return;}

    for(let s=0;s<segments.length;s++){for(let i=0;i<segments[s].length;i++){let dx=segments[s][i].x-x, dy=segments[s][i].y-y; if(dx*dx+dy*dy<25){selectedPoint=segments[s][i]; return;}}}
}

function onCanvasMouseMove(e){
    const {x,y}=getMousePos(e);
    if(draggingHodoIndex!=-1){let dx=x-startDragX,dy=y-startDragY; offsetXs[draggingHodoIndex]+=dx; offsetYs[draggingHodoIndex]+=dy; startDragX=x; startDragY=y; draw(); return;}
    if(selectedPoint){selectedPoint.x=x; selectedPoint.y=y; draw();}
}

function onCanvasMouseUp(e){draggingHodoIndex=-1; selectedPoint=null;}
function getMousePos(e){const rect=canvas.getBoundingClientRect(); return{x:e.clientX-rect.left,y:e.clientY-rect.top};}

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let totalLength=0;
    for(let s=0;s<segments.length;s++){
        let segPoints=segments[s]; if(segPoints.length<2) continue;
        drawPolygon(segPoints); drawControlPoints(segPoints);
        let segLen=drawBezierCurve(segPoints); totalLength+=segLen;
        if(showDerivative){ let deriv=computeHodographPoints(segPoints,hodographScale); drawHodograph(deriv,offsetXs[s],offsetYs[s]); }
    }
    infoLength.textContent="Length: "+totalLength.toFixed(2);
    infoTValue.textContent="t = "+animT.toFixed(2);
    if(segments.length>0){let lastSeg=segments[segments.length-1]; if(lastSeg.length>=2) drawTMarker(lastSeg,animT);}
}

function drawPolygon(points){ctx.strokeStyle="black";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y); for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y); ctx.stroke();}
function drawControlPoints(points){ctx.fillStyle="orange"; for(let p of points){ctx.beginPath();ctx.arc(p.x,p.y,5,0,2*Math.PI);ctx.fill();}}
function drawBezierCurve(points){
    if(points.length<2) return 0; ctx.strokeStyle="red"; ctx.lineWidth=2; ctx.beginPath();
    let steps=100, old=evaluateBezier(points,0); ctx.moveTo(old.x,old.y); let lengthSum=0;
    for(let i=1;i<=steps;i++){let t=i/steps, now=evaluateBezier(points,t); ctx.lineTo(now.x,now.y); lengthSum+=Math.hypot(now.x-old.x, now.y-old.y); old=now;}
    ctx.stroke(); return lengthSum;
}

function computeHodographPoints(pts,scale){
    let n=pts.length-1; if(n<1) return[]; let out=[];
    for(let i=0;i<n;i++){out.push({x:(pts[i+1].x-pts[i].x)*n*scale,y:(pts[i+1].y-pts[i].y)*n*scale});} return out;
}

function drawHodograph(derivativePoints,offsetX,offsetY){
    if(!derivativePoints || derivativePoints.length<1) return;
    ctx.strokeStyle="blue"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(offsetX+derivativePoints[0].x,offsetY-derivativePoints[0].y);
    for(let i=1;i<derivativePoints.length;i++) ctx.lineTo(offsetX+derivativePoints[i].x,offsetY-derivativePoints[i].y); ctx.stroke();
    for(let p of derivativePoints){ctx.beginPath();ctx.arc(offsetX+p.x,offsetY-p.y,4,0,2*Math.PI); ctx.fillStyle="blue";ctx.fill();}
    let sumX=0,sumY=0; for(let p of derivativePoints){sumX+=offsetX+p.x; sumY+=offsetY-p.y;}
    let midX=sumX/derivativePoints.length, midY=sumY/derivativePoints.length;
    ctx.beginPath(); ctx.arc(midX,midY,8,0,2*Math.PI); ctx.fillStyle="blue"; ctx.fill();
}

function drawTMarker(points,t){
    let pt=evaluateBezier(points,t), d1=evaluateBezierDerivative(points,t); let scale=0.2, vx=d1.x*scale, vy=d1.y*scale;
    ctx.strokeStyle="green"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(pt.x,pt.y); ctx.lineTo(pt.x+vx,pt.y+vy); ctx.stroke();
    ctx.beginPath(); ctx.arc(pt.x,pt.y,5,0,2*Math.PI); ctx.fillStyle="purple"; ctx.fill();
    let d2=evaluateBezierSecondDerivative(points,t); let speed=Math.hypot(d1.x,d1.y), cross=d1.x*d2.y-d1.y*d2.x;
    let curvature=(speed!==0)?Math.abs(cross)/Math.pow(speed,3):0; infoCurvature.textContent="Curvature: "+curvature.toFixed(4);
}

function evaluateBezier(pts,t){return deCasteljau(pts,t);}
function deCasteljau(pts,t){let tmp=pts.map(p=>({x:p.x,y:p.y})); let n=pts.length-1; for(let r=1;r<=n;r++){for(let i=0;i<=n-r;i++){tmp[i].x=(1-t)*tmp[i].x+t*tmp[i+1].x; tmp[i].y=(1-t)*tmp[i].y+t*tmp[i+1].y;}} return {x:tmp[0].x,y:tmp[0].y};}
function evaluateBezierDerivative(pts,t){let n=pts.length-1; if(n<1) return {x:0,y:0}; let dx=0,dy=0; for(let i=0;i<n;i++){let b=Math.pow(1-t,n-1-i)*Math.pow(t,i); dx+=b*(pts[i+1].x-pts[i].x); dy+=b*(pts[i+1].y-pts[i].y);} dx*=n; dy*=n; return {x:dx,y:dy};}
function evaluateBezierSecondDerivative(pts,t){let n=pts.length-1; if(n<2) return {x:0,y:0}; let ddx=0,ddy=0; for(let i=0;i<=n-2;i++){let ax=pts[i+2].x-2*pts[i+1].x+pts[i].x; let ay=pts[i+2].y-2*pts[i+1].y+pts[i].y; let b=Math.pow(1-t,n-2-i)*Math.pow(t,i); ddx+=ax*b; ddy+=ay*b*b;} ddx*=n*(n-1); ddy*=n*(n-1); return {x:ddx,y:ddy};}

function removeClosestPoint(x,y){
    let minDist=Infinity, si=-1, pi=-1;
    for(let s=0;s<segments.length;s++){for(let i=0;i<segments[s].length;i++){let dx=segments[s][i].x-x, dy=segments[s][i].y-y; let dist=dx*dx+dy*dy; if(dist<minDist){minDist=dist; si=s; pi=i;}}}
    if(si>=0 && pi>=0 && Math.sqrt(minDist)<10) segments[si].splice(pi,1);
}

function exportToSVG(){
    let parts=[`<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`];
    for(let s=0;s<segments.length;s++){if(segments[s].length<2) continue;
        let steps=50; let p0=evaluateBezier(segments[s],0); let data=[`M ${p0.x.toFixed(3)},${p0.y.toFixed(3)}`];
        for(let i=1;i<=steps;i++){let pt=evaluateBezier(segments[s],i/steps); data.push(`L ${pt.x.toFixed(3)},${pt.y.toFixed(3)}`);}
        parts.push(`<path d="${data.join(" ")}" fill="none" stroke="red" stroke-width="2"/>`);
    }
    parts.push("</svg>");
    console.log("SVG Export:\n", parts.join("\n"));
    alert("SVG Export - виж конзолата!");
}

function animationLoop(){if(!isAnimating) return; animT+=0.001*animSpeed; if(animT>1) animT=0; sliderT.value=animT; draw(); requestAnimationFrame(animationLoop);}
