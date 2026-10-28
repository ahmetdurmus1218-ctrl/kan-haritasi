import{o as e}from"./rolldown-runtime-BCiCTKAo.js";import{n as t,t as n}from"./jsx-runtime-lrofIGTe.js";import{At as r,Tt as i,X as a,_ as o,_t as s,a as c,b as ee,d as l,f as u,i as te,tt as d,zt as f}from"./extends-DC1BzR_J.js";import{a as p,c as m,i as h,l as g,n as ne,o as _,r as re,s as v,t as ie,u as y}from"./Explorer-LNKEJkhf.js";var b=e(t(),1),x=n(),S=1,ae=9,C=-.65,w=-1.6,T=[`#16030a`,2.2,11],E=new f(Math.cos(C),Math.sin(C),0),oe=`
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
  }`,se=`
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
  }`;function D(e,t,n){let r=y(t),i={r:new Float32Array(e),th:new Float32Array(e),z:new Float32Array(e),spin:new Float32Array(e),axis:[]};for(let t=0;t<e;t++)i.r[t]=Math.sqrt(r())*n,i.th[t]=r()*Math.PI*2,i.z[t]=-9+r()*ae*2,i.spin[t]=r()*Math.PI*2,i.axis.push(new f(r()-.5,r()-.5,r()-.5).normalize());return i}var O=new a,k=new s,A=new f,j=new f;function ce(e,t,n){let r=Math.atan2(Math.sin(e-C),Math.cos(e-C)),i=t-w,a=Math.exp(-(r*r)/.34-i*i/2.2);return S*(1-.5*n*a)}var M=[{position:[.18,.22,5.4],target:[0,-.04,0]},{position:[.25,.1,3.8],target:[.2,-.15,0]},{position:[-.32*E.x,-.32*E.y,1],target:[.8*E.x,.8*E.y,w]}];function le(e){let t=e<=0?M[0]:e===1?M[1]:M[2],n=e>=7?1.2:0;return{position:[t.position[0]-n*.1*E.x,t.position[1]-n*.1*E.y,t.position[2]+n],target:[...t.target]}}var ue=240,N=330,de=110,P=290,fe=80,F=160,pe=26,I=80,L=90,R=14,z=5;function me({state:e,onSelect:t,reducedMotion:n,params:a}){p(`#0d0206`,T,.3),g(le(e.stage),{min:.05,max:3},{position:[0,.1,8.2],target:[0,0,0]});let s=m(e,n),E=e.stage,M=v(E>=7?1:E>=5?.16:E>=3?.08:0,.35),me=v(E>=3?E>=6?1:.55:E===2?.2:0,.8),he=v(+(E>=4&&E<=6),1.2),ge=v(E>=2?.62:0,1.2),_e=v(Math.max(0,Math.min(1,((a.tg??1)-1.5)/3.5)),1.5),ve=v(Math.max(0,Math.min(1,((a.inflam??.5)-1)/4)),1.5),ye=h(ue,a.rbc,N),be=h(de,a.ldl,P),xe=h(fe,a.hdl,F),Se=h(pe,a.plt,I),Ce=Math.min(L,Math.round(Math.max(0,(a.tg??1)-1.1)*16)),we=.13*(a.rbcSize??1),Te=_(()=>{let e=new ee(S,S,18,160,180,!0);return e.rotateX(Math.PI/2),e}),Ee=_(()=>new i({vertexShader:oe,fragmentShader:se,side:1,transparent:!0,uniforms:{uPlaque:{value:0},uLipid:{value:0},uInflam:{value:0},uActivate:{value:0},uWindow:{value:0},uTime:{value:0},uPulse:{value:1},uLesionTheta:{value:C},uLesionZ:{value:w},uFogColor:{value:new o(T[0])},uFogNear:{value:T[1]},uFogFar:{value:T[2]},uSelected:{value:0}}})),De=_(()=>re()),Oe=_(()=>new d({color:`#b3202c`,roughness:.42,metalness:0,emissive:`#3a0508`,emissiveIntensity:.6})),B=_(()=>new r(1,18,12)),ke=_(()=>new d({color:`#f0b13c`,roughness:.35,emissive:`#5a3200`,emissiveIntensity:.5})),Ae=_(()=>new d({color:`#7fe3d8`,roughness:.3,emissive:`#0c3a36`,emissiveIntensity:.6})),je=_(()=>new d({color:`#f0b13c`,roughness:.5,emissive:`#3a2000`,emissiveIntensity:.5})),Me=_(()=>{let e=new r(1,14,8);return e.scale(1,.32,1),e}),Ne=_(()=>new d({color:`#e7c6dc`,roughness:.5})),Pe=_(()=>ne(3,.07,3)),Fe=_(()=>new d({color:`#9aa6ff`,roughness:.6,emissive:`#10163a`,emissiveIntensity:.6})),Ie=_(()=>new r(1,10,8)),Le=_(()=>new d({color:`#ffe08a`,roughness:.25,emissive:`#6a4a00`,emissiveIntensity:.5})),Re=_(()=>new d({color:`#5eead4`,emissive:`#5eead4`,emissiveIntensity:1.5,wireframe:!0,transparent:!0,opacity:.7})),ze=_(()=>new r(1,16,10)),Be=_(()=>new d({color:`#fff4dc`,roughness:.3,emissive:`#5a4a30`,emissiveIntensity:.45,transparent:!0,opacity:.9})),Ve=(0,b.useMemo)(()=>{let e=n?400:1e3,t=y(99),r=new Float32Array(e*3);for(let n=0;n<e;n++){let e=Math.sqrt(t())*.96,i=t()*Math.PI*2;r[n*3]=Math.cos(i)*e,r[n*3+1]=Math.sin(i)*e,r[n*3+2]=-9+t()*ae*4}let i=new u;return i.setAttribute(`position`,new l(r,3)),i},[n]),He=_(()=>new i({uniforms:{uColor:{value:new o(`#ffcdbf`)},uMilk:{value:0}},vertexShader:`
          uniform float uMilk;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (26.0 + 30.0 * uMilk) / -mv.z; gl_Position = projectionMatrix * mv; }`,fragmentShader:`
          uniform vec3 uColor;
          uniform float uMilk;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (0.22 + 0.4 * uMilk);
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }`,transparent:!0,depthWrite:!1,blending:2})),V=(0,b.useMemo)(()=>({rbc:D(N,1,.84),ldl:D(P,2,.93),hdl:D(F,3,.95),plt:D(I,4,.9),trl:D(L,5,.9)}),[]),Ue=(0,b.useMemo)(()=>{let e=y(7);return Array.from({length:R},()=>({th:C+(e()-.5)*.7,z:w+(e()-.5)*1.6,r:1.035+e()*.07}))},[]),We=(0,b.useMemo)(()=>{let e=y(11);return Array.from({length:z},(t,n)=>({th:C+(n/4-.5)*.75,z:w+(e()-.5)*1.1,delay:e()*2.5}))},[]),H=(0,b.useRef)(null),U=(0,b.useRef)(null),W=(0,b.useRef)(null),G=(0,b.useRef)(null),K=(0,b.useRef)(null),q=(0,b.useRef)(null),J=(0,b.useRef)(null),Ge=(0,b.useRef)(null),Ke=(0,b.useRef)(null),qe=(0,b.useRef)(null),Y=(0,b.useRef)(null),X=(0,b.useRef)({stage:E,t:0});X.current.stage!==E&&(X.current={stage:E,t:s.current});let Z=(0,b.useMemo)(()=>new o,[]),Je=c(e=>e.camera),Ye=c(e=>e.controls),Q=(0,b.useMemo)(()=>({a:new f,b:new f,ab:new f,ap:new f}),[]),Xe=e=>{let{a:t,b:n,ab:r,ap:i}=Q;r.subVectors(n,t),i.subVectors(e,t);let a=Math.max(0,Math.min(1,i.dot(r)/Math.max(1e-6,r.lengthSq())));return i.addScaledVector(r,-a).length()};te((t,r)=>{let i=s.current;Q.a.copy(Je.position),Ye?Ye.getTarget(Q.b):Q.b.set(0,0,0),Q.b.lerp(Q.a,.25);let a=Ee.uniforms;a.uPlaque.value=M.current,a.uLipid.value=me.current,a.uInflam.value=he.current,a.uActivate.value=ve.current,He.uniforms.uMilk.value=_e.current,a.uWindow.value=ge.current,a.uTime.value=i,a.uSelected.value=+(e.selected===`endothelium`||e.selected===`wall`||e.selected===`plaque`);let o=2.1*(.72+.45*Math.max(0,Math.sin(i*6.9))**2),c=Math.min(r,.05),ee=M.current,l=(t,r,i)=>{let a=ce(t.th[r],t.z[r],ee)-i,s=Math.min(t.r[r],Math.max(0,a)),l=o*(1-s*s/1)+.05;return t.z[r]=t.z[r]-l*c*(e.playing?e.speed:0)*(n?.35:1),t.z[r]<-9&&(t.z[r]=t.z[r]+18),s},u=(e,t,n,r,a,o,s)=>{if(e){e.count=n;for(let c=0;c<n;c++){if(s?.(c)){O.makeScale(0,0,0),e.setMatrixAt(c,O);continue}let n=l(t,c,r);A.set(Math.cos(t.th[c])*n,Math.sin(t.th[c])*n,t.z[c]),Xe(A)<.3+r?(O.makeScale(0,0,0),e.setMatrixAt(c,O)):(k.setFromAxisAngle(t.axis[c],t.spin[c]+i*o*(1+c%5*.2)),a?j.set(r*2,r*2,r*2):j.setScalar(r),O.compose(A,k,j),e.setMatrixAt(c,O))}e.instanceMatrix.needsUpdate=!0}};u(H.current,V.rbc,ye,we,!0,.8);let te=E>=2;u(U.current,V.ldl,be,.045,!1,.5,e=>te&&e<R),u(W.current,V.hdl,xe,.028,!1,.5),u(G.current,V.plt,Se,.05,!1,1.2),u(K.current,V.trl,Ce,.075,!1,.3);let d=q.current;if(d){let e=i-X.current.t;for(let t=0;t<R;t++){let n=Ue[t];if(!te)O.makeScale(0,0,0);else{let r=E>2?1:Math.min(1,Math.max(0,(e-t*.25)/3.2)),i=r*r*(3-2*r),a=.9,o=a+(n.r-a)*i,s=n.z+.9*(1-i);A.set(Math.cos(n.th)*o,Math.sin(n.th)*o,s);let c=E>=6?Math.max(0,1-(E>6?1:Math.min(1,(e-t*.3)/4))):1;j.setScalar(.045*(.25+.75*c)),k.identity(),O.compose(A,k,j)}d.setMatrixAt(t,O);let r=+(E>=3);Z.set(r?`#8f7a36`:`#f0b13c`),d.setColorAt(t,Z)}d.instanceMatrix.needsUpdate=!0,d.instanceColor&&(d.instanceColor.needsUpdate=!0)}let f=J.current,p=Ge.current;if(f){let e=i-X.current.t,t=0;for(let n=0;n<z;n++){let r=We[n];if(E<4){O.makeScale(0,0,0),f.setMatrixAt(n,O);continue}let a=.86,o=r.z,s=.11;if(E===4){let t=Math.min(1,Math.max(0,(e-r.delay)/5));o=r.z+3.2*(1-t)}else{let t=E===5?Math.min(1,Math.max(0,(e-r.delay*.5)/4)):1;a=.86+(1.1-.86)*t,s=.11+.05*t+(E>=6?.03:0)}A.set(Math.cos(r.th)*a,Math.sin(r.th)*a,o),k.setFromAxisAngle(j.set(0,0,1),i*.2+n),j.setScalar(s),O.compose(A,k,j),f.setMatrixAt(n,O);let c=E>=6?`#f2d7a0`:E>=5?`#c7a2ff`:`#9aa6ff`;if(f.setColorAt(n,Z.set(c)),p&&E>=6)for(let e=0;e<7;e++){let i=e*2.39996+n,c=.55*s;A.set(Math.cos(r.th)*a+Math.cos(i)*c*.8,Math.sin(r.th)*a+Math.sin(i)*c*.8,o+Math.sin(i*1.7)*c),j.setScalar(s*.32),k.identity(),O.compose(A,k,j),p.setMatrixAt(t++,O)}}f.instanceMatrix.needsUpdate=!0,f.instanceColor&&(f.instanceColor.needsUpdate=!0),p&&(p.count=t,p.instanceMatrix.needsUpdate=!0)}let m=Ke.current;m&&(m.position.z=-(i*1.4%18));let h=qe.current,g=Y.current;if(h){let t=!1;if(g&&e.selected){let e={rbc:H.current,ldl:U.current,hdl:W.current,platelet:G.current,vldl:K.current,oxldl:q.current,monocyte:J.current}[g.kind];e&&(e.getMatrixAt(g.id,O),O.decompose(A,k,j),j.x>0&&(h.position.copy(A),h.scale.setScalar(Math.max(j.x,j.y)*1.9+.02),h.rotation.set(i,i*.7,0),t=!0))}h.visible=t}});let $=e=>n=>{if(n.delta>8)return;n.stopPropagation();let r=e;e===`oxldl`&&E<3&&(r=`ldl`),e===`monocyte`&&(r=E>=6?`foam`:E>=5?`macrophage`:`monocyte`),Y.current=n.instanceId===void 0?null:{kind:e,id:n.instanceId},t(r)};return(0,x.jsxs)(`group`,{children:[(0,x.jsx)(`ambientLight`,{intensity:.35,color:`#ffb3a8`}),(0,x.jsx)(`hemisphereLight`,{args:[`#ffd0c8`,`#200006`,.5]}),(0,x.jsx)(ie,{intensity:6,color:`#ffe6de`,distance:10}),(0,x.jsx)(`mesh`,{geometry:Te,material:Ee,onClick:e=>{if(e.delta>8)return;e.stopPropagation(),Y.current=null;let n=e.point,r=Math.atan2(n.y,n.x),i=Math.atan2(Math.sin(r-C),Math.cos(r-C)),a=Math.abs(i)<.6&&Math.abs(n.z-w)<1.3;t(a&&E>=7?`plaque`:a&&E>=2?`wall`:`endothelium`)},renderOrder:1}),(0,x.jsx)(`instancedMesh`,{ref:H,args:[De,Oe,N],onClick:$(`rbc`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:U,args:[B,ke,P],onClick:$(`ldl`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:W,args:[B,Ae,F],onClick:$(`hdl`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:G,args:[Me,Ne,I],onClick:$(`platelet`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:K,args:[B,Be,L],onClick:$(`vldl`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:q,args:[B,je,R],onClick:$(`oxldl`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:J,args:[Pe,Fe,z],onClick:$(`monocyte`),frustumCulled:!1}),(0,x.jsx)(`instancedMesh`,{ref:Ge,args:[Ie,Le,35],raycast:()=>null,frustumCulled:!1}),(0,x.jsx)(`points`,{ref:Ke,geometry:Ve,material:He,frustumCulled:!1,raycast:()=>null}),(0,x.jsx)(`mesh`,{ref:qe,geometry:ze,material:Re,visible:!1,raycast:()=>null})]})}export{me as default};