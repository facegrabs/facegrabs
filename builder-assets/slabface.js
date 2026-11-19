/* Slab Pro face engine for the FaceGrabs builder.
   A line-for-line port of the drawing code in SlabProView.mc (drawActive, drawTilesFx, shade, outline,
   textPick, loadPalette, tone and the rest) for the 454 px AMOLED layout (fenix 8 47 mm).
   Real pixels in: the dial art of each finish (dial-*.jpg) and the face's own bitmap fonts (font-*.png);
   everything else is the same see-through fills, lines and polygons the watch draws, at the same alpha.
   Settings array order = the watch's own setting numbers:
   0 Finish 1 Accent 2 FieldLeft 3 FieldRight 4 Bar 5 Seconds 6 Font 7 BarStyle 8 Background(unused) 9 Shade
   10..13 Tile left, right, time, bottom   14..17 Text left, right, time, bottom */
var SlabFace=(function(){
"use strict";
var W=454;
var PALETTES=[[0x35CFEA],[0xFF9632],[0x4BE38A],[0xFF4D4D],[0xFFC93C],[0xB48CFF],[0xFFFFFF],[0x3D7BFF],[0xFF5FA2],[0xB6F23A],[0x2FD6B5],
[0x3D7BFF,0xFF8A2A],[0x3D7BFF,0xFFC93C],[0x3D7BFF,0xE8323C],[0x3D7BFF,0xC0C6CE],[0x7CC4FF,0x3D7BFF],[0x1FA65A,0xFFC93C],[0x1FA65A,0xFFFFFF],
[0x8A5CF5,0xFFC93C],[0x8A5CF5,0x2FD6B5],[0xE8323C,0xFFC93C],[0xE8323C,0xC0C6CE],[0xE8323C,0xFFFFFF],[0xB8324E,0xFFC93C],[0x1FB5A8,0xFF8A2A],
[0xFF8A2A,0xFFFFFF],[0x5A5F68,0xFFC93C],
[0xFF3B3B,0xFF9632,0xFFD93C,0x4BE38A,0x3D8BFF,0xB06CFF],[0xC3B091,0x8A9A4B]];
var BACKGROUNDS=[0x2F6BFF,0x1E3A9E,0x12A89A,0x1FA65A,0x9CD81E,0xF5B920,0xFF7A1A,0xE0242E,0x9E2140,0xFF4F97,0x7A48EE,0xC0C6CE];
var TILE_PALETTE=BACKGROUNDS.concat([0x000000,0xFFFFFF,0x4E5C1A,0x8A6234,0x355A36,0xC8B286]);
var CAMO=[0x8A6234,0xC8B286,0x4E5C1A,0x355A36];
var GLASS_RING=[0xAC77FF,0x8A7AFF,0x7284FF,0x618CFF,0x5594FF,0x4C97FF,0x449BFF,0x3E9BFF,0x399DFF,0x3BA1FF,0x4BABFF,0x4CADFF,0x44AEFF,0x3EB1FF,0x3AB7FF,0x37BEFF,0x35C6FF,0x34D4FF,0x34E0FF,0x34E9FF,0x2AF1FF,0x21F6FF,0x31FAFF,0x37F9FF,0x36F7FF,0x36EFFF,0x37E7FF,0x3BD9FF,0x40C9FF,0x45B2FF,0x4997FF,0x4F7DFF,0x5466FF,0x5A54FF,0x664DFF,0x6E48FF,0x7346FF,0x7C49FF,0x7D48FF,0x8549FF,0x904EFF,0x9348FF,0x9E47FF,0xAD49FF,0xC14EFF,0xD753FF,0xEB57FF,0xFF5CFF,0xFF61EE,0xFF57E3,0xFF46D9,0xFF47D5,0xFF48D5,0xFF4BD5,0xFF4FDA,0xFF55E1,0xFF5DED,0xFF6AFD,0xE870FF,0xCD73FF];
var WASH=36, WASH_LIGHT=55, WASH_BW=88, WASH_DEEP=60;
function deep(c){var r=(c>>16)&255,g=(c>>8)&255,b=c&255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);return idiv(r*3+g*6+b,10)<90||mx-mn<70}
var cal={px:0,py:0,lx:0,ly:0,rx:0,ry:0,tx:0,ty:1,lodd:0.5,lev:0.5,dr:0.5,ddx:0,ddy:0,lx2:0,ly2:0};   // ty: the watch centres text one pixel lower than half the font height
// Fixed demo values (what the face shows in the pictures): time 10:08, TUE 17, second 37.
var DEMO={hour:"10",min:"08",sec:37,wd:"TUE",day:"17"};
var FIELDS=[["6,842","STEPS",0],["68°","TEMP",0],["72","HEART RATE",0],["58","RESTING HR",-1],["74","BODY BATT",0],["28","STRESS",0],
["5:48","SUNSET",0],["1,240","ALT FT",0],["9","FLOORS",0],["1,860","CALORIES",0],["3.4","MILES",0],["112","ACTIVE MIN",0],["14","RECOVERY",0],["9","DAYS LEFT",0]];
var BARS=[[59,"59%   9d",false],[68.42,"6,842 / 10,000",false],[74,"BODY BATTERY 74",false],[74.67,"112 / 150 MIN",false]];

// ---------- number helpers: Monkey C integer maths (division truncates toward zero) ----------
function idiv(a,b){return Math.trunc(a/b)}
function lum(c){return idiv(((c>>16)&255)*3+((c>>8)&255)*6+(c&255),10)}
function lightTile(c){return lum(c)>128}   // (the watch's own line for washed tiles; 138 only decides wash strength)
function blend(c,t,pct){
  var r=((c>>16)&255)+idiv((((t>>16)&255)-((c>>16)&255))*pct,100);
  var g=((c>>8)&255)+idiv((((t>>8)&255)-((c>>8)&255))*pct,100);
  var b=(c&255)+idiv(((t&255)-(c&255))*pct,100);
  return (r<<16)|(g<<8)|b;
}
function tone(c,pct){
  if(pct===0)return c;
  return lum(c)<35?blend(c,0xFFFFFF,idiv(pct*7,10)):blend(c,0x000000,pct);
}
function inkFg(c){return lightTile(c)?0x101214:0xFFFFFF}
function inkSoft(c){return lightTile(c)?0x30353C:0xE2E6EA}
function vis(c,tile,ink){
  var d=Math.abs(((c>>16)&255)-((tile>>16)&255))+Math.abs(((c>>8)&255)-((tile>>8)&255))+Math.abs((c&255)-(tile&255));
  var l=Math.abs(lum(c)-lum(tile));
  return (d<130||l<50)?ink:c;
}
function css(c,a){return "rgba("+((c>>16)&255)+","+((c>>8)&255)+","+(c&255)+","+(a/255)+")"}
function hex(c){return "#"+("000000"+(c>>>0).toString(16)).slice(-6)}

// ---------- fonts: the face's own bitmap fonts (white-on-clear alpha atlases) ----------
var fontMeta=null, fontImg={}, fontReady={}, maskCache={};
function fontFile(kind,f,ring){
  var r=ring?"r":"";
  if(kind==="h")return "hours"+f+r;
  if(kind==="m")return "minutes"+f+r;
  return kind==="l"?"label"+r:"small"+r;
}
function setFonts(meta,images){fontMeta=meta;fontImg=images}
function fontOf(name){return {name:name,h:fontMeta[name].h,c:fontMeta[name].c,img:fontImg[name]}}
function textW(font,s){var w=0;for(var i=0;i<s.length;i++){var g=font.c[s.charCodeAt(i)];w+=g?g[6]:0}return w}
function mask(font,s){
  var key=font.name+"|"+s;if(maskCache[key])return maskCache[key];
  var w=Math.max(1,textW(font,s)+8),h=font.h+4,cv=document.createElement("canvas");cv.width=w;cv.height=h;
  var x=cv.getContext("2d"),pen=0;
  for(var i=0;i<s.length;i++){var g=font.c[s.charCodeAt(i)];if(!g)continue;
    x.drawImage(font.img,g[0],g[1],g[2],g[3],pen+g[4],g[5],g[2],g[3]);pen+=g[6]}
  return maskCache[key]={cv:cv,w:w,h:h};
}
var tmp=document.createElement("canvas");
// just: "l","c","r"; vertical is always centred on y
function drawText(ctx,font,s,x,y,just,color){
  var m=mask(font,s),w=textW(font,s);
  var x0=just==="l"?x:(just==="c"?x-idiv(w,2):x-w+1);   // (the watch's right-aligned text lands one pixel right of x minus its width)
  var y0=y-idiv(font.h,2);
  if(tmp.width!==m.w||tmp.height!==m.h){tmp.width=m.w;tmp.height=m.h}
  var t=tmp.getContext("2d");t.globalCompositeOperation="source-over";t.clearRect(0,0,m.w,m.h);
  t.fillStyle=hex(color);t.fillRect(0,0,m.w,m.h);t.globalCompositeOperation="destination-in";t.drawImage(m.cv,0,0);
  ctx.drawImage(tmp,x0+cal.tx,y0+cal.ty);
}

// ---------- the face ----------
function render(S,ctx,dial){
  var finish=S[0], ring=S[5]===2, K=ring?0.82:1.0, ice=finish===1;
  function sc(v){return Math.trunc(v*W*K/454+0.5)}
  function p(v){return Math.trunc(W/2+(v-227)*W*K/454+0.5)}
  function pd(v){var k=ring?0.935:1.0;return Math.trunc(W/2+(v-227)*W*k/454+0.5)}
  function raw(v){return idiv(v*W+227,454)}
  function u(v){var n=idiv(v*W+227,454);return n<1?1:n}
  var fh=fontOf(fontFile("h",S[4+2],ring)), fm=fontOf(fontFile("m",S[6],ring)), fl=fontOf(fontFile("l",0,ring)), fs=fontOf(fontFile("s",0,ring));
  var font=S[6];

  function ink(c,a){var s=css(c,a);ctx.fillStyle=s;ctx.strokeStyle=s}
  function setc(c){var s=hex(c);ctx.fillStyle=s;ctx.strokeStyle=s}
  function poly(pts){ctx.beginPath();ctx.moveTo(pts[0][0]+cal.px,pts[0][1]+cal.py);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0]+cal.px,pts[i][1]+cal.py);ctx.closePath();ctx.fill()}
  function line(x0,y0,x1,y1){var o=(Math.round(ctx.lineWidth)%2)?cal.lodd:cal.lev;ctx.beginPath();ctx.moveTo(x0+o+cal.lx,y0+o+cal.ly);ctx.lineTo(x1+o+cal.lx,y1+o+cal.ly);ctx.stroke()}
  function pen(w){ctx.lineWidth=w}
  function strip(pts,sx,sy){for(var i=0;i+1<pts.length;i++){var ax=pd(pts[i][0]),ay=pd(pts[i][1]),bx=pd(pts[i+1][0]),by=pd(pts[i+1][1]);poly([[ax,ay],[bx,by],[bx+sx,by+sy],[ax+sx,ay+sy]])}}
  function rim(pts,ox,oy){for(var i=0;i+1<pts.length;i++)line(pd(pts[i][0])+ox,pd(pts[i][1])+oy,pd(pts[i+1][0])+ox,pd(pts[i+1][1])+oy)}
  function outline(pts){
    var half=W/2, edge=W*228/454*(ring?0.935:1.0)-1, out=[], y0=9999, y1=0, n=pts.length;
    for(var i=0;i<n;i++){var a=pts[i],b=pts[(i+1)%n];
      var steps=Math.trunc((Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]))/28)+1;
      for(var s=0;s<steps;s++){
        var x=pd(a[0]+(b[0]-a[0])*s/steps)-half, y=pd(a[1]+(b[1]-a[1])*s/steps)-half, d=Math.sqrt(x*x+y*y);
        if(d>edge){x=x*edge/d;y=y*edge/d}
        out.push([half+x,half+y]);
        if(half+y<y0)y0=Math.trunc(half+y);
        if(half+y>y1)y1=Math.trunc(half+y)+1;
      }}
    var mx=0,my=0;for(i=0;i<out.length;i++){mx+=out[i][0];my+=out[i][1]}
    var solid=[[mx/out.length,my/out.length]].concat(out);solid.push(out[0]);
    return [solid,y0,y1,out];
  }

  // palette
  var shadeSet=S[9], src=PALETTES[S[1]], pal=[];
  for(var i=0;i<src.length;i++){
    var c=src[i], r=(c>>16)&255, g=(c>>8)&255, bl=c&255, l=idiv(r*3+g*6+bl,10);
    if(shadeSet===1){var low=190;if(l<low){var t=idiv((low-l)*100,255-l);c=((r+idiv((255-r)*t,100))<<16)|((g+idiv((255-g)*t,100))<<8)|(bl+idiv((255-bl)*t,100))}}
    else if(shadeSet===2){var high=90;if(l>high)c=(idiv(r*high,l)<<16)|(idiv(g*high,l)<<8)|idiv(bl*high,l)}
    else if(ice){
      if(c===0xFFFFFF&&src.length===1)c=0x101214;
      else{var cap=140;if(l>cap)c=(idiv(r*cap,l)<<16)|(idiv(g*cap,l)<<8)|idiv(bl*cap,l)}
    }else if(l<70&&c!==0x5A5F68){var t2=idiv((70-l)*100,255-l);c=((r+idiv((255-r)*t2,100))<<16)|((g+idiv((255-g)*t2,100))<<8)|(bl+idiv((255-bl)*t2,100))}
    pal.push(c);
  }
  var lead=(pal.length>1&&src[0]===0x5A5F68)?pal[1]:pal[0];
  var secC=pal.length===2?pal[1]:lead;

  var fg=ice?0x101214:0xFFFFFF, soft=ice?0x5A616A:(finish===4?0xCBD0D8:0x8E959D), off=ice?0xC4C9CF:0x121315;
  var accent=lead, red=ice?0xC62828:0xFF3B3B, green=ice?0x0E8A45:0x4BE38A, tick=ice?0xC4C9CF:0x34373C;

  // tile colors, tonal rows, washes
  var rc=[-1,-1,-1,-1];
  for(var t=0;t<4;t++){var tv=S[10+t];rc[t]=tv===0?-1:(tv>TILE_PALETTE.length?CAMO[t]:TILE_PALETTE[tv-1])}
  var step=[0,0,0,0];
  if(rc[2]>=0){var topSame=false;for(t=0;t<2;t++){if(rc[t]===rc[2]){step[t]=20;topSame=true}}
    if(rc[3]===rc[2])step[3]=topSame?40:20}
  if(rc[3]>=0&&step[3]===0&&(rc[3]===rc[0]||rc[3]===rc[1]))step[3]=20;
  var base=[[0x2E3034,0x484B51,0x26282B],[0xDDE6ED,0xF6F9FB,0xD0DAE2],[0x1E1F21,0x2D2F32,0x17181A],[0x3A3129,0x5F4F3F,0x2F2821],[0x914F8C,0x69658B,0x486995]][finish];
  var tile=[-1,-1,-1,-1],eff=[-1,-1,-1,-1],wash=[36,36,36,36],see=[0,0,0,0];
  for(t=0;t<4;t++){
    var under=base[t<2?0:t-1];
    tile[t]=rc[t]<0?-1:tone(rc[t],step[t]);
    wash[t]=lum(under)>138?WASH_LIGHT:WASH;
    if(rc[t]===0xFFFFFF)wash[t]=WASH_BW;else if(rc[t]===0)wash[t]=WASH_DEEP;else if(rc[t]>=0&&wash[t]===WASH&&deep(rc[t]))wash[t]=WASH_DEEP;
    eff[t]=tile[t]<0?tile[t]:blend(under,tile[t],wash[t]);
    see[t]=eff[t]<0?under:eff[t];
  }
  function textPick(t,auto){var v=S[14+t];if(v===0)return auto;
    if(v===3+BACKGROUNDS.length)return lightTile(see[t])?[0xC62828,0xC4570E,0x9A7400,0x0E8A45][t]:[0xFF4D4D,0xFF9632,0xFFD93C,0x4BE38A][t];
    if(v>3+BACKGROUNDS.length)return [0xC3B091,0x6B7A35][v-4-BACKGROUNDS.length];
    return v===1?0xFFFFFF:(v===2?0x000000:BACKGROUNDS[v-3])}

  ctx.save();
  ctx.beginPath();ctx.arc(W/2,W/2,W/2,0,Math.PI*2);ctx.clip();   // the screen is round
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#000";ctx.fillRect(0,0,W,W);
  ctx.drawImage(dial,0,0);
  ctx.lineCap="butt";

  // ---- drawTilesFx ----
  var lowEdge=[[84,396],[114,426],[340,426],[370,396],[370,314]];
  var cardTop=[[-20,150],[262,150],[280,132],[480,132]];
  var cardBot=[[-20,332],[234,332],[252,314],[480,314]];
  var lightDial=lightTile(see[2]), k=lightDial?55:100;
  function shade(pts,c,w,g0,g1){
    var o=outline(pts),solid=o[0];
    if(c>=0){ink(c,idiv(w*255,100));poly(solid)}
    if(g0===0&&g1===0)return;
    var bands=Math.abs(g0-g1)>12?12:6;
    for(var b=0;b<bands;b++){
      var g=g0+idiv((g1-g0)*b,bands-1);
      if(g===0)continue;
      ink(g>0?0xFFFFFF:0x000000,idiv(Math.abs(g)*255,100));
      var ya=o[1]+idiv((o[2]-o[1])*b,bands), yb=o[1]+idiv((o[2]-o[1])*(b+1),bands);
      ctx.save();ctx.beginPath();ctx.rect(0,ya,W,yb-ya+(b===bands-1?1:0));ctx.clip();poly(solid);ctx.restore();
    }
  }
  ink(0,idiv(50*k,100));strip(lowEdge,u(5),u(16));strip([[392,64],[392,116]],u(5),u(16));
  ink(0,idiv(70*k,100));strip(lowEdge,u(3),u(9));strip([[392,64],[392,123]],u(3),u(9));
  ink(blend(see[3],0,55),215);strip(lowEdge,u(2),u(4));
  ink(blend(see[1],0,55),215);strip([[392,64],[392,128]],u(2),u(4));
  shade([[96,30],[227,30],[227,150],[62,150],[62,64]],tile[0],wash[0],6,0);
  shade([[227,30],[358,30],[392,64],[392,132],[280,132],[262,150],[227,150]],tile[1],wash[1],6,0);
  shade([[84,332],[234,332],[252,314],[370,314],[370,396],[340,426],[114,426],[84,396]],tile[3],wash[3],-5,-15);
  if(tile[0]>=0||tile[1]>=0){ink(lightTile(see[0])?0:0xFFFFFF,70);line(pd(227),pd(46),pd(227),pd(122))}
  pen(u(3));
  ink(0xFFFFFF,lightDial?110:58);rim([[62,64],[96,30],[358,30]],0,u(2));
  ink(0xFFFFFF,26);rim([[62,150],[62,64]],u(1),0);rim([[84,332],[84,396]],u(1),0);
  ink(0,idiv(80*k,100));rim([[392,64],[392,132]],-u(1),0);rim([[370,314],[370,396]],-u(1),0);
  ink(0,idiv(115*k,100));rim([[84,396],[114,426],[340,426],[370,396]],0,-u(2));
  pen(1);
  ink(0,idiv(34*k,100));strip(cardBot,0,u(24));
  ink(0,idiv(60*k,100));strip(cardBot,0,u(17));strip(cardBot,0,u(11));
  ink(0,idiv(85*k,100));strip(cardBot,0,u(6));
  ink(0,idiv(38*k,100));strip(cardTop,0,-u(8));strip(cardTop,0,-u(4));
  shade([[-20,150],[262,150],[280,132],[480,132],[480,314],[252,314],[234,332],[-20,332]],tile[2],wash[2],7,-17);
  pen(u(2));
  ink(0xFFFFFF,lightDial?220:165);rim(cardTop,0,u(1));
  ink(0xFFFFFF,lightDial?110:65);rim(cardTop,0,u(3));
  ink(0,idiv(150*k,100));rim(cardBot,0,-u(1));
  ink(0,idiv(70*k,100));rim(cardBot,0,-u(3));
  pen(1);
  if(ring){setc(0);pen(raw(16));ctx.beginPath();ctx.arc(W/2,W/2,idiv(W*213,454)+raw(8),0,Math.PI*2);ctx.stroke();pen(1)}

  // ---- seconds ring ----
  var sec=DEMO.sec;
  if(S[5]===2){
    var cc=W/2, r0=cc-raw(12), r1=cc-raw(2);
    pen(raw(3));
    for(i=0;i<60;i++){
      var a=i*6*Math.PI/180, sx=Math.sin(a), cy=-Math.cos(a);
      var on=(finish===4&&pal.length<=2)?GLASS_RING[i]:(pal.length===2?secC:pal[Math.min(pal.length-1,idiv(i*pal.length,60))]);
      setc(i<=sec?on:tick);line(cc+r0*sx,cc+r0*cy,cc+r1*sx,cc+r1*cy);
    }
    pen(1);
  }

  // ---- time ----
  var dateRight,dateY,lineY,lift=2;
  function drawTime(dx,dy){
    if(font===0){
      var ht=fh.h,mt=fm.h,xm=p(285);
      drawText(ctx,fh,DEMO.hour,p(4)+dx,p(232)+dy,"l",curC);
      drawText(ctx,fm,DEMO.min,xm+dx,p(232)-idiv(ht,2)+idiv(mt,2)+dy,"l",curC);
      dateRight=xm+textW(fm,DEMO.min)-sc(13);dateY=p(232)+idiv(ht,2)-sc(12);lineY=p(232)-idiv(ht,2)-sc(14)-lift;
    }else{
      var ht=fh.h,mt=fm.h,hw=textW(fh,DEMO.hour),mw=textW(fm,DEMO.min),gap=sc(40),x0=p(238)-idiv(hw+gap+mw,2);
      var over=x0+hw+gap+mw-p(430);if(over>0)x0-=over;
      var my=p(232)-idiv(ht,2)+idiv(mt,2);
      drawText(ctx,fh,DEMO.hour,x0+dx,p(232)+dy,"l",curC);
      drawText(ctx,fm,DEMO.min,x0+hw+gap+dx,my+dy,"l",curC);
      var cx=x0+hw+idiv(gap,2)+dx;
      setc(curC);ctx.beginPath();ctx.arc(cx+cal.ddx,my-idiv(mt,5)+dy+cal.ddy,sc(6)+cal.dr,0,7);ctx.fill();ctx.beginPath();ctx.arc(cx+cal.ddx,my+idiv(mt,5)+dy+cal.ddy,sc(6)+cal.dr,0,7);ctx.fill();
      dateRight=x0+hw+gap+mw;dateY=p(232)+idiv(ht,2)-sc(12);lineY=p(232)-idiv(ht,2)-sc(14)-lift;
    }
  }
  var curC=0xFFFFFF;
  var tc=eff[2], tink=tc<0?fg:inkFg(tc), tfg=textPick(2,tink), tsoft=textPick(2,tc<0?soft:inkSoft(tc));
  if(tc>=0)tink=vis(tfg,tc,tink);
  var tacc=tc<0?accent:vis(accent,tc,tink), tsec=tc<0?secC:vis(secC,tc,tink);
  var tl=lightTile(see[2]);
  curC=blend(see[2],0,tl?20:38);drawTime(sc(4),sc(6));
  curC=blend(see[2],0,tl?36:66);drawTime(sc(2),sc(3));
  curC=tfg;drawTime(0,0);
  var shT=blend(see[2],0,lightTile(see[2])?30:60), so=sc(2), shOn=!lightTile(see[2]);

  if(S[5]===1){
    if(shOn)drawText(ctx,fs,pad2(sec),p(26)+so,p(302)+so,"l",shT);
    drawText(ctx,fs,pad2(sec),p(26),p(302),"l",tsec);
    setc(tsec);pen(raw(3));line(pd(24),pd(320),pd(24)+idiv((pd(150)-pd(24))*sec,59),pd(320));pen(1);
  }
  function pad2(n){return (n<10?"0":"")+n}

  // ---- date ----
  var dayStr=DEMO.day, weekday=DEMO.wd, dateR=dateRight;
  var weekdayRight=dateR-textW(fl,dayStr)-textW(fl," ")-sc(4), weekdayW=textW(fl,weekday);
  if(shOn){drawText(ctx,fl,weekday,weekdayRight+so,dateY+so,"r",shT);drawText(ctx,fl,dayStr,dateR+so,dateY+so,"r",shT)}
  drawText(ctx,fl,weekday,weekdayRight,dateY,"r",tacc);
  var n=pal.length===2?1:pal.length;
  if(n>2&&pal.length>2){
    // Rainbow: a bolder bar the length of the hairline, one segment per color, and a matching bar under the hours
    var bh=sc(5),bw=sc(142),bx=dateR+sc(2)-bw,by=lineY+sc(2)-idiv(bh,2),ux=pd(24),uw=pd(150)-ux,uy=pd(320)-idiv(bh,2),under=S[5]!==1;
    for(i=0;i<n;i++){setc(pal[i]);
      var a0=bx+idiv(bw*i,n),a1=bx+idiv(bw*(i+1),n);ctx.fillRect(a0,by,a1-a0,bh);
      if(under){var c0=ux+idiv(uw*i,n),c1=ux+idiv(uw*(i+1),n);ctx.fillRect(c0,uy,c1-c0,bh)}}
  }else{
  for(i=0;i<n;i++){
    var bc2=pal.length===2?secC:pal[i];
    setc(tc<0?bc2:vis(bc2,tc,tink));
    var x0=weekdayRight-weekdayW+idiv(weekdayW*i,n), x1=weekdayRight-weekdayW+idiv(weekdayW*(i+1),n);
    ctx.fillRect(x0,lineY,x1-x0,sc(4));
  }
  setc(tsoft);pen(1);
  line(dateR-sc(140),lineY+sc(2),dateR+sc(2),lineY+sc(2));
  }
  drawText(ctx,fl,dayStr,dateR,dateY,"r",tfg);

  // ---- top fields ----
  var xs=[148,306], valueY=pd(76), captionY=pd(104);
  for(i=0;i<2;i++){
    var f=FIELDS[S[2+i]], x=p(xs[i]), uc=eff[i], ufg=fg, usoft=soft, ured=red, ugreen=green;
    if(uc>=0){var ul=lightTile(uc);ufg=inkFg(uc);usoft=inkSoft(uc);
      ured=vis(ul?0xC62828:0xFF3B3B,uc,ufg);ugreen=vis(ul?0x0E8A45:0x4BE38A,uc,ufg)}
    ufg=textPick(i,ufg);usoft=textPick(i,usoft);
    if(!lightTile(see[i])){
      var shc=blend(see[i],0,50);
      drawText(ctx,fl,f[0],x+1,valueY+so,"c",shc);drawText(ctx,fs,f[1],x+1,captionY+so,"c",shc);
    }
    drawText(ctx,fl,f[0],x,valueY,"c",ufg);
    if(f[2]!==0){
      var ax=x+idiv(textW(fl,f[0]),2)+sc(13), ay=valueY, s=sc(7);
      setc(f[2]>0?ured:ugreen);
      poly(f[2]>0?[[ax-s,ay+s],[ax+s,ay+s],[ax,ay-s]]:[[ax-s,ay-s],[ax+s,ay-s],[ax,ay+s]]);
    }
    drawText(ctx,fs,f[1],x,captionY,"c",usoft);
  }

  // ---- bottom gauge ----
  var bc=eff[3];
  if(bc>=0){fg=inkFg(bc);soft=inkSoft(bc);accent=vis(accent,bc,fg);red=vis(lightTile(bc)?0xC62828:0xFF3B3B,bc,fg);off=blend(bc,lightTile(bc)?0:0xFFFFFF,18)}
  var fgInk=fg;
  fg=textPick(3,fg);soft=textPick(3,soft);
  var b=BARS[S[4]];if(S[4]===0){var bpv=[59,80,40,12][S[19]||0];b=[bpv,bpv+"%   9d",bpv<=15]}
  var pct=b[0], lit=Math.trunc((pct+4)/8.34);
  if(lit<1&&pct>0)lit=1;if(lit>12)lit=12;
  var level=S[18]===1&&S[4]===0;
  if(level){var lc=pct<=20?2:(pct<=50?1:0),dk=bc>=0?lightTile(bc):ice;
    accent=(dk?[0x0E8A45,0xB38600,0xC62828]:[0x45CC6E,0xF2C230,0xEF4B42])[lc];if(bc>=0)accent=vis(accent,bc,fg)}
  var style=S[7], gh=sc([18,16,28][style]), capH=sc(18), gap2=sc(17), gy=pd(381)-idiv(gh+gap2+capH,2), capY=gy+gh+gap2+idiv(capH,2);
  var full=pct>100?100:pct;
  function rrect(x,y,w,h,r,stroke){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arc(x+w-r,y+r,r,-Math.PI/2,0);ctx.lineTo(x+w,y+h-r);ctx.arc(x+w-r,y+h-r,r,0,Math.PI/2);
    ctx.lineTo(x+r,y+h);ctx.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);ctx.lineTo(x,y+r);ctx.arc(x+r,y+r,r,Math.PI,Math.PI*1.5);ctx.closePath();
    if(stroke)ctx.stroke();else ctx.fill();
  }
  if(style===1){
    var w=Math.trunc(sc(192)*full/100);
    setc(off);rrect(p(131),gy,sc(192),gh,idiv(gh,2));
    if(w>0){if(w<gh)w=gh;setc(b[2]?red:accent);rrect(p(131),gy,w,gh,idiv(gh,2))}
  }else if(style===2){
    pen(sc(2));setc(soft);rrect(p(141),gy,sc(164),gh,sc(7),true);rrect(p(141)+sc(166),gy+sc(8),sc(6),gh-sc(16),sc(2));
    var w2=Math.trunc(sc(154)*full/100);
    if(w2>0){if(w2<sc(8))w2=sc(8);setc(b[2]?red:accent);rrect(p(141)+sc(5),gy+sc(5),w2,gh-sc(10),sc(4))}
    pen(1);
  }else{
    for(i=0;i<12;i++){var xx=p(131+i*16);var segc=accent;if(pal.length>2&&!level)segc=bc>=0?vis(pal[Math.min(pal.length-1,idiv(i*pal.length,12))],bc,fg):pal[Math.min(pal.length-1,idiv(i*pal.length,12))];
    setc(i<lit?(b[2]?red:segc):off);
      poly([[xx+sc(6),gy],[xx+sc(16)-1,gy],[xx+sc(10)-1,gy+gh],[xx,gy+gh]])}
  }
  if(!lightTile(see[3]))drawText(ctx,fs,b[1],p(227)+1,capY+so,"c",blend(see[3],0,50));
  drawText(ctx,fs,b[1],p(227),capY,"c",fg);
  ctx.restore();
}

return {cal:cal,render:render,setFonts:setFonts,fontFile:fontFile,DEMO:DEMO,PALETTES:PALETTES,GLASS_RING:GLASS_RING};
})();
