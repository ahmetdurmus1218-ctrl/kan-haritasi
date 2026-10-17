"""Test vektörü üretici: tek bileşenli JPEG Lossless (SOF3) kodlayıcı, öngörü 1–7 ve yeniden başlatma aralığı.
Kaynak görüntü deterministiktir: v(x, y) = (x*37 + y*101 + (x*y % 17)*13) & 0xfff (12 bit)."""
import sys, numpy as np
W, H, P = 61, 37, 12
img = np.array([[(x*37 + y*101 + (x*y % 17)*13) & 0xfff for x in range(W)] for y in range(H)], np.int64)
def encode(ps, ri):
    mask = (1 << P) - 1; init = 1 << (P - 1)
    diffs = []
    reset = 0; cnt = 0
    for y in range(H):
        for x in range(W):
            i = y*W + x
            if ri and cnt == ri: cnt = 0; reset = i; diffs.append(None)
            if i == reset: pred = init
            elif y == reset // W: pred = img[y, x-1]
            elif x == 0: pred = img[y-1, x]
            else:
                ra, rb, rc = img[y, x-1], img[y-1, x], img[y-1, x-1]
                pred = [None, ra, rb, rc, ra+rb-rc, ra+((rb-rc)>>1), rb+((ra-rc)>>1), (ra+rb)>>1][ps]
            d = (int(img[y, x]) - int(pred)) & 0xffff
            if d >= 32768: d -= 65536
            diffs.append(d); cnt += 1
    cat = lambda d: 0 if d == 0 else (16 if d == 32768 else int(abs(d)).bit_length())
    # Sabit (her kategoriye 8 bitlik değil) basit kanonik tablo: kategoriler 0..16, uzunluk 5
    vals = list(range(17)); bits = [0]*16; bits[4] = 17  # 17 kod × 5 bit (32 kapasite)
    codes = {v: k for k, v in enumerate(vals)}
    out = bytearray(b'\xff\xd8')
    out += b'\xff\xc4' + (2+1+16+17).to_bytes(2, 'big') + b'\x00' + bytes(bits) + bytes(vals)
    out += b'\xff\xc3' + (8+3).to_bytes(2, 'big') + bytes([P]) + H.to_bytes(2, 'big') + W.to_bytes(2, 'big') + b'\x01\x01\x11\x00'
    if ri: out += b'\xff\xdd\x00\x04' + ri.to_bytes(2, 'big')
    out += b'\xff\xda\x00\x08\x01\x01\x00' + bytes([ps, 0, 0])
    acc = []; rst = 0
    def flush():
        while len(acc) % 8: acc.append(1)
        for k in range(0, len(acc), 8):
            b = int(''.join(map(str, acc[k:k+8])), 2); out.append(b)
            if b == 0xff: out.append(0)
        acc.clear()
    for d in diffs:
        if d is None:
            flush(); out += bytes([0xff, 0xd0 + rst]); rst = (rst + 1) % 8; continue
        s = cat(d); acc.extend(int(c) for c in format(codes[s], '05b'))
        if s and s != 16:
            v = d if d > 0 else d + (1 << s) - 1
            acc.extend(int(c) for c in format(v, f'0{s}b'))
    flush(); out += b'\xff\xd9'
    return bytes(out)
if __name__ == '__main__':
    import os
    od = sys.argv[1]; os.makedirs(od, exist_ok=True)
    from pylibjpeg import decode  # bağımsız çözücü (libjpeg) ile denetim
    for ps in range(1, 8):
        for ri in (0, W, 2 * W):
            b = encode(ps, ri)
            try:
                ok = (np.asarray(decode(b)).astype(np.int64) == img).all()
            except Exception as e:
                ok = f'libjpeg error {e}'
            name = f'p{ps}-ri{ri}.jpg'; open(os.path.join(od, name), 'wb').write(b)
            print(name, len(b), 'libjpeg_match=', ok)
