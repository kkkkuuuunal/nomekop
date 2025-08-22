(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const dialog = document.getElementById('dialog');
  const picker = document.getElementById('picker');
  const pickerChoices = document.getElementById('pickerChoices');

  const TILE = 40;
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const COLS = WIDTH / TILE;
  const ROWS = HEIGHT / TILE;
  const SPEED = 2.2;

  const STATE = {
    running: false,
    scene: 'town',
    player: { x: WIDTH/2, y: HEIGHT/2, w: 26, h: 26, color: '#1a1a1a' },
    keys: { w:false, a:false, s:false, d:false },
    npc: { x: 4*TILE, y: 2*TILE, w: 28, h: 28 },
    house: { x: 13*TILE, y: 5*TILE, w: 4*TILE, h: 4*TILE, door: {x: 14*TILE, y: 9*TILE, w: TILE, h: TILE}, indoorDoor: {} },
    trees: [],
    roads: [],
    obstacles: [],
    interiorObstacles: [],
    pickedNomekop: null,
    starterMoves: [],
  };

  const STARTERS = [
    { name: 'Blue', color: '#4da6ff', moves: ['Tackle', 'Splash'] },
    { name: 'Red', color: '#ff4d4d', moves: ['Tackle', 'Flame'] },
    { name: 'Green', color: '#4dff4d', moves: ['Tackle', 'Vine Whip'] }
  ];

  function rectIntersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function pushRect(list, x,y,w,h){ list.push({x,y,w,h}); }

  function buildTown() {
    STATE.trees = [];
    STATE.roads = [];
    STATE.obstacles = [];

    for (let c=0; c<COLS; c++) pushRect(STATE.roads, c*TILE, 7*TILE, TILE, TILE);
    for (let r=0; r<ROWS; r++) pushRect(STATE.roads, 10*TILE, r*TILE, TILE, TILE);

    const H = STATE.house;
    pushRect(STATE.obstacles, H.x, H.y, H.w, TILE);
    pushRect(STATE.obstacles, H.x, H.y+H.h-TILE, H.w, TILE);
    pushRect(STATE.obstacles, H.x, H.y, TILE, H.h);
    pushRect(STATE.obstacles, H.x+H.w-TILE, H.y, TILE, H.h);

    const TCOUNT = 26;
    for (let i=0;i<TCOUNT;i++) {
      const tx = Math.floor(Math.random()*COLS)*TILE;
      const ty = Math.floor(Math.random()*ROWS)*TILE;
      const tree = {x:tx+6,y:ty+6,w:TILE-12,h:TILE-12};
      const cellRect = {x:tx,y:ty,w:TILE,h:TILE};
      const onRoad = STATE.roads.some(r => rectIntersects(cellRect, r));
      const inHouseArea = rectIntersects(cellRect, {x:H.x-TILE,y:H.y-TILE,w:H.w+2*TILE,h:H.h+2*TILE});
      if (!onRoad && !inHouseArea) {
        STATE.trees.push(tree);
        STATE.obstacles.push(tree);
      }
    }
  }

  function buildInterior() {
    STATE.interiorObstacles = [];
    const doorY = HEIGHT - TILE; // bottom door
    const doorX = WIDTH/2 - TILE/2;

    // walls around edges, leaving bottom door gap
    pushRect(STATE.interiorObstacles, 0, 0, WIDTH, TILE); // top
    pushRect(STATE.interiorObstacles, 0, 0, TILE, HEIGHT); // left
    pushRect(STATE.interiorObstacles, WIDTH-TILE, 0, TILE, HEIGHT); // right
    // bottom wall left of door
    pushRect(STATE.interiorObstacles, 0, doorY, doorX, TILE);
    // bottom wall right of door
    pushRect(STATE.interiorObstacles, doorX + TILE, doorY, WIDTH - (doorX + TILE), TILE);

    // indoor door
    STATE.house.indoorDoor = { x: doorX, y: doorY, w: TILE, h: TILE };
  }

  function resetState() {
    STATE.running = false;
    STATE.scene = 'town';
    STATE.player.x = WIDTH/2 - STATE.player.w/2;
    STATE.player.y = HEIGHT/2 - STATE.player.h/2;
    picker.classList.add('hidden');
    hideDialog();
  }

  function drawTown() {
    ctx.fillStyle = '#86d36b';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = '#bba37d';
    STATE.roads.forEach(r => ctx.fillRect(r.x, r.y, r.w, r.h));
    const H = STATE.house;
    ctx.fillStyle = '#b44a4a';
    ctx.fillRect(H.x, H.y, H.w, H.h);
    ctx.fillStyle = '#8f3939';
    ctx.fillRect(H.x, H.y, H.w, TILE);
    const d = H.door;
    ctx.fillStyle = '#3b2a1f';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    const N = STATE.npc;
    ctx.fillStyle = '#3a5ea9';
    ctx.fillRect(N.x, N.y, N.w, N.h);
    ctx.fillStyle = '#2e7b32';
    STATE.trees.forEach(t=>{
      ctx.fillRect(t.x+10,t.y+18,8,10);
      ctx.beginPath(); ctx.arc(t.x+t.w/2, t.y+14, 16, 0, Math.PI*2); ctx.fill();
    });
  }

  function drawInterior() {
    ctx.fillStyle = '#d8cfb1';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    const door = STATE.house.indoorDoor;
    ctx.fillStyle = '#7c5a3a';
    ctx.fillRect(door.x, door.y, door.w, door.h);
    // draw starter sprite if chosen
    if(STATE.pickedNomekop){
      ctx.fillStyle = STATE.player.color;
      ctx.fillRect(WIDTH/2-20, HEIGHT/2-20, 40, 40);
    }
  }

  function drawPlayer() {
    const P = STATE.player;
    ctx.fillStyle = P.color;
    ctx.fillRect(P.x, P.y, P.w, P.h);
    ctx.fillStyle = '#ffdb70';
    ctx.fillRect(P.x+6, P.y-2, 14, 6);
  }

  function draw() {
    if (STATE.scene === 'town') drawTown(); else drawInterior();
    drawPlayer();
  }

  function movePlayer() {
    const P = STATE.player;
    let vx=0, vy=0;
    if (STATE.keys.w) vy -= SPEED;
    if (STATE.keys.s) vy += SPEED;
    if (STATE.keys.a) vx -= SPEED;
    if (STATE.keys.d) vx += SPEED;

    P.x += vx;
    const colliders = STATE.scene==='town' ? STATE.obstacles : STATE.interiorObstacles;
    for (const o of colliders) { if (rectIntersects(P, o)) { if (vx>0) P.x = o.x-P.w; if (vx<0) P.x=o.x+o.w; } }
    P.x = Math.max(0, Math.min(P.x, WIDTH-P.w));

    P.y += vy;
    for (const o of colliders) { if (rectIntersects(P, o)) { if (vy>0) P.y=o.y-P.h; if (vy<0) P.y=o.y+o.h; } }
    P.y = Math.max(0, Math.min(P.y, HEIGHT-P.h));
  }

  function interact() {
    const P = STATE.player;
    if (STATE.scene==='town') {
      if (Math.hypot(P.x-STATE.npc.x, P.y-STATE.npc.y)<50) {
        showDialog('NPC: Welcome to Nomekop!');
        setTimeout(hideDialog,2500);
        return;
      }
      if (rectIntersects(P, STATE.house.door)) enterHouse();
    } else if (STATE.scene==='house') {
      if (rectIntersects(P, STATE.house.indoorDoor)) exitHouse();
    }
  }

  function enterHouse() {
    STATE.scene='house';
    STATE.player.x=WIDTH/2-STATE.player.w/2;
    STATE.player.y=HEIGHT-TILE*2;
    hideDialog();
    if(!STATE.pickedNomekop) showPicker();
    else showDialog(`Welcome back! You have ${STATE.pickedNomekop}.`);
  }

  function showPicker(){
    pickerChoices.innerHTML = '';
    STARTERS.forEach(starter=>{
      const btn=document.createElement('button');
      btn.textContent = starter.name;
      btn.onclick=()=>{
        STATE.pickedNomekop = starter.name;
        STATE.player.color = starter.color;
        STATE.starterMoves = starter.moves;
        picker.classList.add('hidden');
        showDialog(`You chose ${starter.name}! Go to the bottom door and press E to leave.`);
      };
      pickerChoices.appendChild(btn);
    });
    picker.classList.remove('hidden');
  }

  function exitHouse() {
    STATE.scene='town';
    const d = STATE.house.door;
    STATE.player.x = d.x + d.w/2 - STATE.player.w/2;
    STATE.player.y = d.y + d.h + 4;
    hideDialog();
  }

  function showDialog(text){ dialog.textContent=text; dialog.classList.remove('hidden'); }
  function hideDialog(){ dialog.classList.add('hidden'); }

  function showMoves(){
    if(STATE.pickedNomekop){
      alert(`${STATE.pickedNomekop}'s moves: ${STATE.starterMoves.join(', ')}`);
    }
  }

  function loop() {
    if(STATE.running){
      movePlayer();
      draw();
    } else draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(['w','a','s','d','e','b'].includes(k)){
      if(['w','a','s','d'].includes(k)) STATE.keys[k]=true;
      if(k==='e') interact();
      if(k==='b') showMoves();
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if(['w','a','s','d'].includes(k)) STATE.keys[k]=false;
  });

  startBtn.addEventListener('click', ()=>{ if(!STATE.running) STATE.running=true; });
  restartBtn.addEventListener('click', ()=>{
    resetState();
    buildTown();
    buildInterior();
  });

  buildTown();
  buildInterior();
  resetState();
  draw();
  requestAnimationFrame(loop);
})();

