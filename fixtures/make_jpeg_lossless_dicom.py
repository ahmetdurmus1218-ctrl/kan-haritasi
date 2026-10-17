"""Açık lisanslı fikstür kesitini (TotalSegmentator örnek BT'si, CC BY 4.0) GDCM ile JPEG Lossless SV1'e çevirir."""
import sys, gdcm
src, dst, ts = sys.argv[1], sys.argv[2], sys.argv[3]
r = gdcm.ImageReader(); r.SetFileName(src); assert r.Read()
c = gdcm.ImageChangeTransferSyntax()
c.SetTransferSyntax(gdcm.TransferSyntax(gdcm.TransferSyntax.JPEGLosslessProcess14_1 if ts == 'sv1' else gdcm.TransferSyntax.JPEGLosslessProcess14))
c.SetInput(r.GetImage()); assert c.Change()
w = gdcm.ImageWriter(); w.SetFileName(dst); w.SetFile(r.GetFile()); w.SetImage(c.GetOutput()); assert w.Write()
print(dst)
