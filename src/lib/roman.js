const TABLE = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
/** 0 is "N" (nulla), as Roman scribes wrote it. */
export function roman(n) {
  if (!n) return 'N';
  let out = '';
  for (const [v, s] of TABLE) while (n >= v) { out += s; n -= v; }
  return out;
}
