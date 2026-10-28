(() => {
  'use strict';
  const WORLD_W=5760,WORLD_H=3240;
  const el=id=>document.getElementById(id);
  const stage=el('stage'),map=el('maplayer'),pins=el('pins'),props=el('props');
  const readout=el('readout'),hint=el('helpToast'),tooltip=el('tooltip');
  const ptr=new Map();
  const state={scale:0.1,tx:0,ty:0,fitScale:0.1,labels:true,meta:null,selected:null,gesture:null};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const pointerCoord=e=>{const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
  const screenToMap=p=>({x:(p.x-state.tx)/state.scale,y:(p.y-state.ty)/state.scale});
  function clampPan(){
    const w=stage.clientWidth,h=stage.clientHeight,mw=WORLD_W*state.scale,mh=WORLD_H*state.scale;
    state.tx=mw<=w?(w-mw)/2:clamp(state.tx,w-mw-65,65);
    state.ty=mh<=h?(h-mh)/2:clamp(state.ty,h-mh-65,65);
  }
  function render(){
    clampPan();
    map.style.transform=`translate3d(${state.tx}px,${state.ty}px,0) scale(${state.scale})`;
    props.childNodes.forEach(node=>{
      const p=node.item;
      if(!p)return;
      node.style.left=(state.tx+(p.x-p.w/2)*state.scale)+'px';
      node.style.top=(state.ty+(p.y-p.h+4)*state.scale)+'px';
      node.style.width=(p.w*state.scale)+'px';node.style.height=(p.h*state.scale)+'px';
    });
    pins.childNodes.forEach(node=>{
      const p=node.item;
      const x=state.tx+p.x*state.scale,y=state.ty+(p.y+16)*state.scale;
      node.style.left=x+'px';node.style.top=y+'px';
      const showNames=state.labels&&(state.scale>0.19||p.name===state.selected);
      node.querySelector('.pin-name').classList.toggle('is-hidden',!showNames);
    });
    let relative=state.scale/state.fitScale;
    readout.textContent=relative<=1.05?'FIT MAP · 100%':Math.round(relative*100)+'% OF FIT';
    el('fit').classList.toggle('active',relative<=1.05);
    if(state.selected)positionTip(state.selected);
  }
  function fitMap(){
    state.fitScale=Math.min((stage.clientWidth-20)/WORLD_W,(stage.clientHeight-25)/WORLD_H);
    state.scale=state.fitScale;
    state.tx=(stage.clientWidth-WORLD_W*state.scale)/2;
    state.ty=(stage.clientHeight-WORLD_H*state.scale)/2;
    state.selected=null;
    tooltip.classList.add('hidden');
    render();
  }
  function zoomAt(mult,p){
    const prev=screenToMap(p);
    state.scale=clamp(state.scale*mult,state.fitScale*0.95,1.6);
    state.tx=p.x-prev.x*state.scale;
    state.ty=p.y-prev.y*state.scale;
    render();
  }
  function centerOn(p,desiredScale){
    if(desiredScale)state.scale=clamp(desiredScale,state.fitScale,1.6);
    state.tx=stage.clientWidth/2-p.x*state.scale;
    state.ty=stage.clientHeight/2-p.y*state.scale;
    render();
  }
  function positionTip(name){
    const f=(state.meta?.fighters||[]).find(p=>p.name===name);
    if(!f)return;
    let sx=state.tx+f.x*state.scale,sy=state.ty+(f.y+16)*state.scale-32;
    tooltip.style.left=clamp(sx,75,stage.clientWidth-75)+'px';
    tooltip.style.top=clamp(sy,70,stage.clientHeight-26)+'px';
  }
  function selectFighter(name){
    const f=state.meta.fighters.find(f=>f.name===name);
    if(!f)return;
    if(state.scale<0.16)centerOn(f,0.28);
    state.selected=f.name;
    tooltip.innerHTML=`<strong>${f.name}</strong> <small>· ${f.team==='blue'?'Blue':'Coral'} team</small>`;
    tooltip.classList.remove('hidden');
    pins.querySelectorAll('.pin').forEach(node=>node.classList.toggle('selected',node.item.name===name));
    render();dismissHint();
  }
  function dismissHint(){hint.classList.add('is-hidden')}
  function makeProps(items){
    for(const p of items||[]){
      const image=new Image();image.src='assets/'+encodeURIComponent(p.file);
      image.alt='';image.decoding='async';image.draggable=false;image.item=p;props.append(image);
    }
  }
  function makePins(fighters){
    for(const p of fighters||[]){
      const btn=document.createElement('button');
      btn.type='button';btn.className='pin '+p.team;
      btn.setAttribute('aria-label','Focus on '+p.name);btn.item=p;
      btn.innerHTML='<span class="pin-name">'+p.name+'</span><span class="pin-circle"></span>';
      btn.addEventListener('click',e=>{e.stopPropagation();selectFighter(p.name)});
      pins.append(btn);
    }
  }
  function setGesture(){
    const points=Array.from(ptr.values());
    if(points.length===2){
      const a=points[0],b=points[1],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      state.gesture={d:Math.hypot(a.x-b.x,a.y-b.y),s:state.scale,world:screenToMap(mid)};
    }else state.gesture=null;
  }
  stage.addEventListener('pointerdown',e=>{
    if(e.target.closest('.pin'))return;
    e.preventDefault();stage.setPointerCapture(e.pointerId);ptr.set(e.pointerId,pointerCoord(e));
    setGesture();
  });
  stage.addEventListener('pointermove',e=>{
    if(!ptr.has(e.pointerId))return;
    e.preventDefault();const next=pointerCoord(e),old=ptr.get(e.pointerId);
    ptr.set(e.pointerId,next);
    if(ptr.size===1){state.tx+=next.x-old.x;state.ty+=next.y-old.y;}
    else if(ptr.size===2&&state.gesture){
      const [a,b]=Array.from(ptr.values()),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const d=Math.hypot(a.x-b.x,a.y-b.y);
      state.scale=clamp(state.gesture.s*(d/Math.max(1,state.gesture.d)),state.fitScale*0.95,1.6);
      state.tx=m.x-state.gesture.world.x*state.scale;
      state.ty=m.y-state.gesture.world.y*state.scale;
    }
    dismissHint();tooltip.classList.add('hidden');state.selected=null;
    render();
  },{passive:false});
  function endPointer(e){ptr.delete(e.pointerId);setGesture()}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,endPointer);
  stage.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1.16:1/1.16,pointerCoord(e));dismissHint()},{passive:false});
  stage.addEventListener('dblclick',e=>{e.preventDefault();zoomAt(2,pointerCoord(e));dismissHint()});
  el('zoomIn').addEventListener('click',()=>{zoomAt(1.6,{x:stage.clientWidth/2,y:stage.clientHeight/2});dismissHint()});
  el('zoomOut').addEventListener('click',()=>{zoomAt(1/1.6,{x:stage.clientWidth/2,y:stage.clientHeight/2});dismissHint()});
  el('fit').addEventListener('click',fitMap);
  el('findPip').addEventListener('click',()=>state.meta&&selectFighter('Pip'));
  el('labels').addEventListener('click',()=>{state.labels=!state.labels;el('labels').classList.toggle('active',state.labels);render()});
  el('outlineToggle').addEventListener('click',()=>{const o=el('collisionOverlay');const visible=o.style.display==='block';o.style.display=visible?'none':'block';el('outlineToggle').classList.toggle('active',!visible);el('outlineToggle').setAttribute('aria-pressed',String(!visible));dismissHint()});
  el('closeHelp').addEventListener('click',dismissHint);
  el('share').addEventListener('click',async()=>{
    const url=location.href;
    if(navigator.share){try{await navigator.share({title:'Tangle Tussle Memory Match V4 collision review',url});return}catch(e){}}
    if(navigator.clipboard){try{await navigator.clipboard.writeText(url);el('share').title='Link copied';return}catch(e){}}
    window.prompt('Copy the viewer link',url);
  });
  let priorW=0,priorH=0;
  const resizeObserver=new ResizeObserver(()=>{
    if(!priorW){priorW=stage.clientWidth;priorH=stage.clientHeight;fitMap();return}
    const oldCenter={x:(priorW/2-state.tx)/state.scale,y:(priorH/2-state.ty)/state.scale};
    const wasFit=state.scale<=state.fitScale*1.05;
    state.fitScale=Math.min((stage.clientWidth-20)/WORLD_W,(stage.clientHeight-25)/WORLD_H);
    if(wasFit){fitMap()}else{
      state.tx=stage.clientWidth/2-oldCenter.x*state.scale;
      state.ty=stage.clientHeight/2-oldCenter.y*state.scale;
      render();
    }
    priorW=stage.clientWidth;priorH=stage.clientHeight;
  });
  resizeObserver.observe(stage);
  fetch('assets/metadata.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Map metadata '+r.status);return r.json()})
    .then(meta=>{state.meta=meta;makeProps(meta.surfaceProps);makePins(meta.fighters);render()})
    .catch(err=>{console.error(err);const h=el('helpToast');h.innerHTML='<span>Map annotations unavailable. Terrain preview still works.</span>'});
})();
