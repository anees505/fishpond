const http = require('http');
const players = {};
const clients = new Map();

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fish Friends Pond</title>
<style>
html,body{height:100%;margin:0;background:#06324a;color:#e8f6ff;font-family:sans-serif}
body{display:flex;flex-direction:column}
#bar{padding:10px;background:#04243a;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#bar b{flex:1}
input[type=text]{padding:8px;border-radius:8px;border:0;width:120px}
button,label{background:#ffb703;color:#222;border:0;border-radius:10px;padding:9px 13px;font-weight:bold}
canvas{flex:1;width:100%;display:block}
#msg{padding:6px 12px;font-size:13px;background:#04243a}
</style></head><body>
<div id="bar"><b>Fish Friends Pond</b>
<span id="form"><input id="nm" type="text" placeholder="Your name" maxlength="14">
<label>Add my face<input id="ph" type="file" accept="image/*" hidden></label>
<button id="join">Join</button></span></div>
<canvas id="c"></canvas><div id="msg">Add your name and face, then press Join.</div>
<script>
var cv=document.getElementById('c'),ctx=cv.getContext('2d'),msg=document.getElementById('msg');
var face=null,fish={},pellets=[],me=localStorage.fishId||(localStorage.fishId=Math.random().toString(36).slice(2));
function size(){cv.width=cv.clientWidth;cv.height=cv.clientHeight}
window.onresize=size;size();
document.getElementById('ph').onchange=function(e){
 var f=e.target.files[0];if(!f)return;var im=new Image();
 im.onload=function(){var k=document.createElement('canvas');k.width=k.height=96;
  var m=Math.min(im.width,im.height);
  k.getContext('2d').drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,96,96);
  face=k.toDataURL('image/jpeg',0.7);msg.textContent='Face ready. Press Join!'};
 im.src=URL.createObjectURL(f)};
function post(url,obj){return fetch(url,{method:'POST',body:JSON.stringify(obj)})}
function connect(){
 var es=new EventSource('/events?id='+me);
 es.onmessage=function(e){var d=JSON.parse(e.data);
  if(d.feed){pellets.push({x:fish[d.feed]?fish[d.feed].x:100,y:-10,t:d.feed});return}
  var seen={};d.players.forEach(function(p){seen[p.id]=1;var f=fish[p.id];
   if(!f)f=fish[p.id]={x:Math.random()*cv.width,y:70+Math.random()*(cv.height-140),vx:(Math.random()<.5?-1:1)*(.6+Math.random())};
   if(!f.img||f.faceSrc!==p.face){f.img=new Image();f.img.src=p.face;f.faceSrc=p.face}
   f.name=p.name;f.fed=p.fed;f.hue=p.hue});
  for(var id in fish)if(!seen[id])delete fish[id];
  msg.textContent=d.players.length+' online. Tap a fish to feed it!'}}
document.getElementById('join').onclick=function(){
 if(!face){msg.textContent='Add your face photo first.';return}
 var n=document.getElementById('nm').value.trim()||'Fishy';
 localStorage.fishProfile=JSON.stringify({name:n,face:face});start(n,face)};
function start(n,fc){
 post('/join',{id:me,name:n,face:fc,hue:Math.floor(Math.random()*360)}).then(function(){
  document.getElementById('form').style.display='none';connect()})}
if(localStorage.fishProfile){var p=JSON.parse(localStorage.fishProfile);start(p.name,p.face)}
cv.onpointerdown=function(e){var r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 for(var id in fish){var f=fish[id];if(Math.hypot(x-f.x,y-f.y)<50){post('/feed',{from:me,to:id});return}}};
function drawFish(f){var d=f.vx>=0?1:-1;ctx.save();ctx.translate(f.x,f.y);ctx.scale(d,1);
 var sc=1+Math.min(f.fed,30)*.02,w=Math.sin(Date.now()/150+f.x)*5;ctx.scale(sc,sc);
 ctx.fillStyle='hsl('+f.hue+',75%,55%)';
 ctx.beginPath();ctx.ellipse(-22,0,50,28,0,0,7);ctx.fill();
 ctx.beginPath();ctx.moveTo(-65,0);ctx.lineTo(-100,-24+w);ctx.lineTo(-100,24+w);ctx.fill();
 ctx.beginPath();ctx.moveTo(-30,-24);ctx.lineTo(-10,-42);ctx.lineTo(0,-22);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(22,0,32,0,7);ctx.clip();
 if(f.img.complete)ctx.drawImage(f.img,-10,-32,64,64);ctx.restore();
 ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(22,0,32,0,7);ctx.stroke();ctx.restore();
 ctx.fillStyle='#fff';ctx.font='13px sans-serif';ctx.textAlign='center';
 ctx.fillText(f.name+' - fed '+f.fed,f.x,f.y+58)}
(function tick(){ctx.clearRect(0,0,cv.width,cv.height);
 for(var id in fish){var f=fish[id];f.x+=f.vx;f.y+=Math.sin(Date.now()/700+f.x/60)*.4;
  if(f.x<80||f.x>cv.width-60)f.vx*=-1;f.y=Math.max(60,Math.min(cv.height-70,f.y));drawFish(f)}
 pellets=pellets.filter(function(p){var f=fish[p.t];p.y+=3;if(f)p.x+=(f.x-p.x)*.03;
  ctx.fillStyle='#ffb703';ctx.beginPath();ctx.arc(p.x,p.y,6,0,7);ctx.fill();return f?p.y<f.y:p.y<cv.height});
 requestAnimationFrame(tick)})();
</script></body></html>`;

function send(obj) {
  const line = 'data: ' + JSON.stringify(obj) + '\n\n';
  for (const res of clients.values()) res.write(line);
}
function broadcastPlayers() {
  const online = [...clients.keys()].filter(id => players[id]).map(id => players[id]);
  send({ players: online });
}
function body(req, cb) {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 300000) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(s)); } catch (e) { cb(null); } });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/events') {
    const id = url.searchParams.get('id');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.set(id, res);
    broadcastPlayers();
    req.on('close', () => { if (clients.get(id) === res) clients.delete(id); broadcastPlayers(); });
  } else if (url.pathname === '/join' && req.method === 'POST') {
    body(req, d => {
      if (d && d.id && typeof d.face === 'string') {
        const old = players[d.id];
        players[d.id] = { id: String(d.id), name: String(d.name).slice(0, 14), face: d.face,
                          fed: old ? old.fed : 0, hue: old ? old.hue : Number(d.hue) || 200 };
        broadcastPlayers();
      }
      res.end('ok');
    });
  } else if (url.pathname === '/feed' && req.method === 'POST') {
    body(req, d => {
      if (d && players[d.to] && clients.has(d.to)) { players[d.to].fed++; send({ feed: d.to }); broadcastPlayers(); }
      res.end('ok');
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
  }
}).listen(process.env.PORT || 3000, () => console.log('Pond running on port ' + (process.env.PORT || 3000)));
