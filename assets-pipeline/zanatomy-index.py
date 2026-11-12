"""
Z-Anatomy FBX envanteri: ikili FBX dosyasındaki her Model düğümünün adını, hiyerarşi yolunu ve üçgen
sayısını JSON olarak yazar (bağımlılıksız, yalnızca okuma). docs/anatomy-sources/z-anatomy-meshes.csv
bu çıktılardan üretildi.

Kullanım: python3 -I zanatomy-index.py <dosya.fbx> <çıktı.json>
"""
import struct, zlib, sys, json
def read(path):
    d = open(path,'rb').read()
    ver = struct.unpack_from('<I', d, 23)[0]
    big = ver >= 7500
    def prop(o):
        t = chr(d[o]); o += 1
        if t in 'YCIFDL':
            fmt = {'Y':'<h','C':'<?','I':'<i','F':'<f','D':'<d','L':'<q'}[t]
            return struct.unpack_from(fmt, d, o)[0], o + struct.calcsize(fmt)
        if t in 'fdlib':
            n, enc, clen = struct.unpack_from('<III', d, o); o += 12
            raw = d[o:o+clen]; o += clen
            if t == 'b': return None, o
            if enc: raw = zlib.decompress(raw)
            fmt = {'f':'f','d':'d','l':'q','i':'i'}[t]
            return (n, raw, fmt), o
        if t in 'SR':
            n = struct.unpack_from('<I', d, o)[0]; o += 4
            s = d[o:o+n]; o += n
            return (s.decode('utf8','replace') if t=='S' else None), o
        raise ValueError(t)
    def node(o):
        if big:
            end, np_, pl = struct.unpack_from('<QQQ', d, o); o += 24
        else:
            end, np_, pl = struct.unpack_from('<III', d, o); o += 12
        nl = d[o]; o += 1
        if end == 0: return None, o
        name = d[o:o+nl].decode(); o += nl
        props = []
        for _ in range(np_):
            v, o = prop(o); props.append(v)
        kids = []
        while o < end:
            k, o = node(o)
            if k is None: break
            kids.append(k)
        return (name, props, kids), end
    o = 27; top = []
    while o < len(d) - 200:
        n, o = node(o)
        if n is None: break
        top.append(n)
    return top
def main(path):
    top = read(path)
    objs = next(k for k in top if k[0]=='Objects')
    conns = next(k for k in top if k[0]=='Connections')
    geo = {}; models = {}
    for n,p,k in objs[2]:
        if n=='Geometry':
            pv = next((c for c in k if c[0]=='PolygonVertexIndex'), None)
            vt = next((c for c in k if c[0]=='Vertices'), None)
            npoly = 0; ntri = 0
            if pv:
                cnt, raw, fmt = pv[1][0]
                idx = struct.unpack(f'<{cnt}i', raw)
                run = 0
                for i in idx:
                    run += 1
                    if i < 0: npoly += 1; ntri += run-2; run = 0
            geo[p[0]] = (ntri, vt[1][0][0]//3 if vt else 0)
        elif n=='Model':
            models[p[0]] = (p[1].split('\x00')[0], p[2])
    parent = {}; mgeo = {}
    for n,p,k in conns[2]:
        if n=='C' and p[0]=='OO':
            a,b = p[1],p[2]
            if a in geo and b in models: mgeo[b] = geo[a]
            elif a in models: parent[a] = b
    out = []
    for mid,(name,typ) in models.items():
        chain=[]; x=parent.get(mid)
        while x in models: chain.append(models[x][0]); x=parent.get(x)
        out.append({'name':name,'type':typ,'path':'/'.join(reversed(chain)),'tris':mgeo.get(mid,(0,0))[0],'verts':mgeo.get(mid,(0,0))[1]})
    return out
if __name__=='__main__':
    res = main(sys.argv[1])
    json.dump(res, open(sys.argv[2],'w'), ensure_ascii=False, indent=0)
    mesh=[r for r in res if r['tris']>0]
    print(sys.argv[1].split('/')[-1], 'models', len(res), 'meshes', len(mesh), 'tris', sum(r['tris'] for r in mesh))
