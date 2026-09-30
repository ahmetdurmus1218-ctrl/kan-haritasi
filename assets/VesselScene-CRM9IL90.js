import{o as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as t,t as n}from"./jsx-runtime-D3F0h15I.js";import{t as r}from"./rng-CjMInbdP.js";import{I as i,N as a,R as o,S as s,U as c,a as l,b as u,c as d,f,g as p,h as m,i as h,k as g,l as _,n as v,o as y,p as ee,r as te,s as b,t as ne,z as x}from"./Explorer-BWZ4hz2A.js";var S=e(t(),1),C=n(),re=1,ie=9,w=-.65,T=-1.6,E=[`#16030a`,2.2,11],D=new c(Math.cos(w),Math.sin(w),0),ae=`
  uniform float uPlaque;
  uniform float uTime;
  uniform float uPulse;
  uniform float uLesionTheta;
  uniform float uLesionZ;
  varying vec3 vPos;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vBump;
  varying vec2 vCell;
  void main() {
    vec3 p = position;
    float th = atan(p.y, p.x);
    float dth = atan(sin(th - uLesionTheta), cos(th - uLesionTheta));
    float dz = p.z - uLesionZ;
    float bump = exp(-(dth * dth) / 0.34 - (dz * dz) / 2.2);
    vBump = bump;
    float beat = 1.0 + uPulse * 0.012 * pow(max(0.0, sin(uTime * 6.9)), 3.0);
    float r = (1.0 - 0.5 * uPlaque * bump) * beat;
    p.xy = normalize(p.xy) * r;
    vPos = p;
    vCell = vec2(th * 7.5, p.z * 2.4);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    // İç yüzeyin normali eksene doğru
    vec3 n = -normalize(vec3(p.xy, -0.9 * uPlaque * bump * dz));
    vNormalV = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
  }`,oe=`
  precision highp float;
  uniform float uLipid;
  uniform float uInflam;
  uniform float uActivate;
  uniform float uWindow;
  uniform float uPlaque;
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uSelected;
  varying vec3 vPos;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vBump;
  varying vec2 vCell;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  // Hücresel desen: x = en yakın merkeze uzaklık, y = sınıra yakınlık
  vec3 cells(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 center = vec2(0.0);
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g + o * 0.8 + 0.1 - f;
      r.y *= 0.55; // akış yönünde uzamış hücreler
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; center = r; }
      else if (d < d2) { d2 = d; }
    }
    return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), length(center));
  }

  void main() {
    vec3 c = cells(vCell);
    float border = 1.0 - smoothstep(0.02, 0.09, c.y);
    float nucleus = 1.0 - smoothstep(0.1, 0.17, c.x);
    vec3 base = vec3(0.62, 0.17, 0.22);
    vec3 col = base * (0.85 + 0.15 * sin(vCell.x * 0.7));
    col = mix(col, vec3(0.36, 0.06, 0.12), border * 0.75);
    col = mix(col, vec3(0.42, 0.16, 0.36), nucleus * 0.6);

    // Lipid birikimi (sarımsı), plak örtüsü (açık, lifli)
    float lesion = smoothstep(0.15, 0.85, vBump);
    col = mix(col, vec3(0.86, 0.66, 0.32), uLipid * lesion * 0.75);
    float cap = uPlaque * smoothstep(0.35, 0.95, vBump);
    col = mix(col, vec3(0.93, 0.84, 0.78), cap * 0.55 * (0.7 + 0.3 * border));

    // İnflamasyon: yapışma molekülleri (soluk mavi-mor noktalar)
    float dots = step(0.86, fract(sin(dot(floor(vCell * 3.0), vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.35, 0.4, 1.0) * dots * uInflam * lesion * (0.6 + 0.4 * sin(uTime * 3.0));
    // Kişisel: CRP yüksekse tüm iç yüzeyde hafif inflamasyon işaretleri
    col += vec3(0.35, 0.4, 1.0) * dots * uActivate * 0.5 * (0.6 + 0.4 * sin(uTime * 3.0 + vCell.x));

    // Işık: kameradan (endoskop) + kenar
    vec3 N = normalize(vNormalV);
    vec3 V = normalize(-vViewPos);
    float diff = clamp(dot(N, V), 0.0, 1.0);
    float rim = pow(1.0 - diff, 2.5);
    vec3 lit = col * (0.28 + 0.95 * diff) + vec3(1.0, 0.55, 0.55) * rim * 0.18;
    lit += vec3(1.0, 0.9, 0.85) * pow(diff, 28.0) * 0.25;
    lit += vec3(0.25, 0.9, 0.85) * uSelected * 0.18 * (1.0 - border);

    float depth = length(vViewPos);
    float fog = smoothstep(uFogNear, uFogFar, depth);
    lit = mix(lit, uFogColor, fog);

    float alpha = 1.0 - uWindow * lesion * (1.0 - cap);
    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }`;function O(e,t,n){let i=r(t),a={r:new Float32Array(e),th:new Float32Array(e),z:new Float32Array(e),spin:new Float32Array(e),axis:[]};for(let t=0;t<e;t++)a.r[t]=Math.sqrt(i())*n,a.th[t]=i()*Math.PI*2,a.z[t]=-9+i()*ie*2,a.spin[t]=i()*Math.PI*2,a.axis.push(new c(i()-.5,i()-.5,i()-.5).normalize());return a}var k=new g,A=new i,j=new c,M=new c;function se(e,t,n){let r=Math.atan2(Math.sin(e-w),Math.cos(e-w)),i=t-T,a=Math.exp(-(r*r)/.34-i*i/2.2);return re*(1-.5*n*a)}var N=[{position:[.18,.22,5.4],target:[0,-.04,0]},{position:[.25,.1,3.8],target:[.2,-.15,0]},{position:[-.32*D.x,-.32*D.y,1],target:[.8*D.x,.8*D.y,T]}];function ce(e){let t=e<=0?N[0]:e===1?N[1]:N[2],n=e>=7?1.2:0;return{position:[t.position[0]-n*.1*D.x,t.position[1]-n*.1*D.y,t.position[2]+n],target:[...t.target]}}var le=240,P=330,ue=110,F=290,de=80,I=160,fe=26,L=80,R=90,z=14,B=5;function pe({state:e,onSelect:t,reducedMotion:n,params:i}){l(`#0d0206`,E,.3),_(ce(e.stage),{min:.05,max:3},{position:[0,.1,8.2],target:[0,0,0]});let g=d(e,n),D=e.stage,N=b(D>=7?1:D>=5?.16:D>=3?.08:0,.35),pe=b(D>=3?D>=6?1:.55:D===2?.2:0,.8),me=b(+(D>=4&&D<=6),1.2),he=b(D>=2?.62:0,1.2),ge=b(Math.max(0,Math.min(1,((i.tg??1)-1.5)/3.5)),1.5),_e=b(Math.max(0,Math.min(1,((i.inflam??.5)-1)/4)),1.5),ve=h(le,i.rbc,P),ye=h(ue,i.ldl,F),be=h(de,i.hdl,I),xe=h(fe,i.plt,L),Se=Math.min(R,Math.round(Math.max(0,(i.tg??1)-1.1)*16)),Ce=.13*(i.rbcSize??1),we=y(()=>{let e=new s(re,re,18,160,180,!0);return e.rotateX(Math.PI/2),e}),Te=y(()=>new o({vertexShader:ae,fragmentShader:oe,side:1,transparent:!0,uniforms:{uPlaque:{value:0},uLipid:{value:0},uInflam:{value:0},uActivate:{value:0},uWindow:{value:0},uTime:{value:0},uPulse:{value:1},uLesionTheta:{value:w},uLesionZ:{value:T},uFogColor:{value:new u(E[0])},uFogNear:{value:E[1]},uFogFar:{value:E[2]},uSelected:{value:0}}})),Ee=y(()=>te()),De=y(()=>new a({color:`#b3202c`,roughness:.42,metalness:0,emissive:`#3a0508`,emissiveIntensity:.6})),V=y(()=>new x(1,18,12)),Oe=y(()=>new a({color:`#f0b13c`,roughness:.35,emissive:`#5a3200`,emissiveIntensity:.5})),ke=y(()=>new a({color:`#7fe3d8`,roughness:.3,emissive:`#0c3a36`,emissiveIntensity:.6})),Ae=y(()=>new a({color:`#f0b13c`,roughness:.5,emissive:`#3a2000`,emissiveIntensity:.5})),je=y(()=>{let e=new x(1,14,8);return e.scale(1,.32,1),e}),Me=y(()=>new a({color:`#e7c6dc`,roughness:.5})),Ne=y(()=>v(3,.07,3)),Pe=y(()=>new a({color:`#9aa6ff`,roughness:.6,emissive:`#10163a`,emissiveIntensity:.6})),Fe=y(()=>new x(1,10,8)),Ie=y(()=>new a({color:`#ffe08a`,roughness:.25,emissive:`#6a4a00`,emissiveIntensity:.5})),Le=y(()=>new a({color:`#5eead4`,emissive:`#5eead4`,emissiveIntensity:1.5,wireframe:!0,transparent:!0,opacity:.7})),Re=y(()=>new x(1,16,10)),ze=y(()=>new a({color:`#fff4dc`,roughness:.3,emissive:`#5a4a30`,emissiveIntensity:.45,transparent:!0,opacity:.9})),Be=(0,S.useMemo)(()=>{let e=n?400:1e3,t=r(99),i=new Float32Array(e*3);for(let n=0;n<e;n++){let e=Math.sqrt(t())*.96,r=t()*Math.PI*2;i[n*3]=Math.cos(r)*e,i[n*3+1]=Math.sin(r)*e,i[n*3+2]=-9+t()*ie*4}let a=new p;return a.setAttribute(`position`,new m(i,3)),a},[n]),Ve=y(()=>new o({uniforms:{uColor:{value:new u(`#ffcdbf`)},uMilk:{value:0}},vertexShader:`
          uniform float uMilk;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (26.0 + 30.0 * uMilk) / -mv.z; gl_Position = projectionMatrix * mv; }`,fragmentShader:`
          uniform vec3 uColor;
          uniform float uMilk;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (0.22 + 0.4 * uMilk);
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }`,transparent:!0,depthWrite:!1,blending:2})),H=(0,S.useMemo)(()=>({rbc:O(P,1,.84),ldl:O(F,2,.93),hdl:O(I,3,.95),plt:O(L,4,.9),trl:O(R,5,.9)}),[]),He=(0,S.useMemo)(()=>{let e=r(7);return Array.from({length:z},()=>({th:w+(e()-.5)*.7,z:T+(e()-.5)*1.6,r:1.035+e()*.07}))},[]),Ue=(0,S.useMemo)(()=>{let e=r(11);return Array.from({length:B},(t,n)=>({th:w+(n/4-.5)*.75,z:T+(e()-.5)*1.1,delay:e()*2.5}))},[]),U=(0,S.useRef)(null),W=(0,S.useRef)(null),G=(0,S.useRef)(null),K=(0,S.useRef)(null),q=(0,S.useRef)(null),J=(0,S.useRef)(null),Y=(0,S.useRef)(null),We=(0,S.useRef)(null),Ge=(0,S.useRef)(null),Ke=(0,S.useRef)(null),X=(0,S.useRef)(null),Z=(0,S.useRef)({stage:D,t:0});Z.current.stage!==D&&(Z.current={stage:D,t:g.current});let qe=(0,S.useMemo)(()=>new u,[]),Je=ee(e=>e.camera),Ye=ee(e=>e.controls),Q=(0,S.useMemo)(()=>({a:new c,b:new c,ab:new c,ap:new c}),[]),Xe=e=>{let{a:t,b:n,ab:r,ap:i}=Q;r.subVectors(n,t),i.subVectors(e,t);let a=Math.max(0,Math.min(1,i.dot(r)/Math.max(1e-6,r.lengthSq())));return i.addScaledVector(r,-a).length()};f((t,r)=>{let i=g.current;Q.a.copy(Je.position),Ye?Ye.getTarget(Q.b):Q.b.set(0,0,0),Q.b.lerp(Q.a,.25);let a=Te.uniforms;a.uPlaque.value=N.current,a.uLipid.value=pe.current,a.uInflam.value=me.current,a.uActivate.value=_e.current,Ve.uniforms.uMilk.value=ge.current,a.uWindow.value=he.current,a.uTime.value=i,a.uSelected.value=+(e.selected===`endothelium`||e.selected===`wall`||e.selected===`plaque`);let o=2.1*(.72+.45*Math.max(0,Math.sin(i*6.9))**2),s=Math.min(r,.05),c=N.current,l=(t,r,i)=>{let a=se(t.th[r],t.z[r],c)-i,l=Math.min(t.r[r],Math.max(0,a)),u=o*(1-l*l/1)+.05;return t.z[r]=t.z[r]-u*s*(e.playing?e.speed:0)*(n?.35:1),t.z[r]<-9&&(t.z[r]=t.z[r]+18),l},u=(e,t,n,r,a,o,s)=>{if(e){e.count=n;for(let c=0;c<n;c++){if(s?.(c)){k.makeScale(0,0,0),e.setMatrixAt(c,k);continue}let n=l(t,c,r);if(j.set(Math.cos(t.th[c])*n,Math.sin(t.th[c])*n,t.z[c]),Xe(j)<.3+r){k.makeScale(0,0,0),e.setMatrixAt(c,k);continue}A.setFromAxisAngle(t.axis[c],t.spin[c]+i*o*(1+c%5*.2)),a?M.set(r*2,r*2,r*2):M.setScalar(r),k.compose(j,A,M),e.setMatrixAt(c,k)}e.instanceMatrix.needsUpdate=!0}};u(U.current,H.rbc,ve,Ce,!0,.8);let d=D>=2;u(W.current,H.ldl,ye,.045,!1,.5,e=>d&&e<z),u(G.current,H.hdl,be,.028,!1,.5),u(K.current,H.plt,xe,.05,!1,1.2),u(q.current,H.trl,Se,.075,!1,.3);let f=J.current;if(f){let e=i-Z.current.t;for(let t=0;t<z;t++){let n=He[t];if(!d)k.makeScale(0,0,0);else{let r=D>2?1:Math.min(1,Math.max(0,(e-t*.25)/3.2)),i=r*r*(3-2*r),a=.9,o=a+(n.r-a)*i,s=n.z+.9*(1-i);j.set(Math.cos(n.th)*o,Math.sin(n.th)*o,s);let c=D>=6?Math.max(0,1-(D>6?1:Math.min(1,(e-t*.3)/4))):1;M.setScalar(.045*(.25+.75*c)),A.identity(),k.compose(j,A,M)}f.setMatrixAt(t,k);let r=+(D>=3);qe.set(r?`#8f7a36`:`#f0b13c`),f.setColorAt(t,qe)}f.instanceMatrix.needsUpdate=!0,f.instanceColor&&(f.instanceColor.needsUpdate=!0)}let p=Y.current,m=We.current;if(p){let e=i-Z.current.t,t=0;for(let n=0;n<B;n++){let r=Ue[n];if(D<4){k.makeScale(0,0,0),p.setMatrixAt(n,k);continue}let a=.86,o=r.z,s=.11;if(D===4){let t=Math.min(1,Math.max(0,(e-r.delay)/5));o=r.z+3.2*(1-t)}else{let t=D===5?Math.min(1,Math.max(0,(e-r.delay*.5)/4)):1;a=.86+(1.1-.86)*t,s=.11+.05*t+(D>=6?.03:0)}j.set(Math.cos(r.th)*a,Math.sin(r.th)*a,o),A.setFromAxisAngle(M.set(0,0,1),i*.2+n),M.setScalar(s),k.compose(j,A,M),p.setMatrixAt(n,k);let c=D>=6?`#f2d7a0`:D>=5?`#c7a2ff`:`#9aa6ff`;if(p.setColorAt(n,qe.set(c)),m&&D>=6)for(let e=0;e<7;e++){let i=e*2.39996+n,c=.55*s;j.set(Math.cos(r.th)*a+Math.cos(i)*c*.8,Math.sin(r.th)*a+Math.sin(i)*c*.8,o+Math.sin(i*1.7)*c),M.setScalar(s*.32),A.identity(),k.compose(j,A,M),m.setMatrixAt(t++,k)}}p.instanceMatrix.needsUpdate=!0,p.instanceColor&&(p.instanceColor.needsUpdate=!0),m&&(m.count=t,m.instanceMatrix.needsUpdate=!0)}let h=Ge.current;h&&(h.position.z=-(i*1.4%18));let _=Ke.current,v=X.current;if(_){let t=!1;if(v&&e.selected){let e={rbc:U.current,ldl:W.current,hdl:G.current,platelet:K.current,vldl:q.current,oxldl:J.current,monocyte:Y.current}[v.kind];e&&(e.getMatrixAt(v.id,k),k.decompose(j,A,M),M.x>0&&(_.position.copy(j),_.scale.setScalar(Math.max(M.x,M.y)*1.9+.02),_.rotation.set(i,i*.7,0),t=!0))}_.visible=t}});let $=e=>n=>{if(n.delta>8)return;n.stopPropagation();let r=e;e===`oxldl`&&D<3&&(r=`ldl`),e===`monocyte`&&(r=D>=6?`foam`:D>=5?`macrophage`:`monocyte`),X.current=n.instanceId===void 0?null:{kind:e,id:n.instanceId},t(r)};return(0,C.jsxs)(`group`,{children:[(0,C.jsx)(`ambientLight`,{intensity:.35,color:`#ffb3a8`}),(0,C.jsx)(`hemisphereLight`,{args:[`#ffd0c8`,`#200006`,.5]}),(0,C.jsx)(ne,{intensity:6,color:`#ffe6de`,distance:10}),(0,C.jsx)(`mesh`,{geometry:we,material:Te,onClick:e=>{if(e.delta>8)return;e.stopPropagation(),X.current=null;let n=e.point,r=Math.atan2(n.y,n.x),i=Math.atan2(Math.sin(r-w),Math.cos(r-w)),a=Math.abs(i)<.6&&Math.abs(n.z-T)<1.3;t(a&&D>=7?`plaque`:a&&D>=2?`wall`:`endothelium`)},renderOrder:1}),(0,C.jsx)(`instancedMesh`,{ref:U,args:[Ee,De,P],onClick:$(`rbc`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:W,args:[V,Oe,F],onClick:$(`ldl`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:G,args:[V,ke,I],onClick:$(`hdl`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:K,args:[je,Me,L],onClick:$(`platelet`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:q,args:[V,ze,R],onClick:$(`vldl`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:J,args:[V,Ae,z],onClick:$(`oxldl`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:Y,args:[Ne,Pe,B],onClick:$(`monocyte`),frustumCulled:!1}),(0,C.jsx)(`instancedMesh`,{ref:We,args:[Fe,Ie,35],raycast:()=>null,frustumCulled:!1}),(0,C.jsx)(`points`,{ref:Ge,geometry:Be,material:Ve,frustumCulled:!1,raycast:()=>null}),(0,C.jsx)(`mesh`,{ref:Ke,geometry:Re,material:Le,visible:!1,raycast:()=>null})]})}export{pe as default};