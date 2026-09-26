/** TC Kimlik No sağlama algoritması; yalnızca test verisine gerçek numara sızmasını yakalamak için. */
export function isValidTcKimlik(s) {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

export function findTcKimlik(text) {
  return [...text.matchAll(/(?<!\d)[1-9]\d{10}(?!\d)/g)].map((m) => m[0]).filter(isValidTcKimlik);
}
