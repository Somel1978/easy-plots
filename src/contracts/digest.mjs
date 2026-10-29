/**
 * Portable SHA-256 for deterministic Foundry document identities. WebCrypto
 * digest is optional because HTTP LAN sessions may lack crypto.subtle.
 * NOT a MAC/signature or a replacement for server-side permissions.
 */
const K=Uint32Array.from([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const ROT=(x,n)=>(x>>>n)|(x<<(32-n));
export function sha256Bytes(message){
  if(!(message instanceof Uint8Array))throw new TypeError('SHA-256 expects bytes');
  const byteLen=message.length;
  // Add 1-bit, zero padding, and 64-bit big-endian message length.
  const paddedLen=Math.ceil((byteLen+9)/64)*64;
  const padded=new Uint8Array(paddedLen);padded.set(message);padded[byteLen]=0x80;
  const lengthBits=byteLen*8;
  const v=new DataView(padded.buffer);
  v.setUint32(paddedLen-8,Math.floor(lengthBits/0x100000000),false);
  v.setUint32(paddedLen-4,lengthBits>>>0,false);
  const h=Uint32Array.from([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const words=new Uint32Array(64);
  for(let offset=0;offset<paddedLen;offset+=64){
    for(let i=0;i<16;i++)words[i]=v.getUint32(offset+4*i,false);
    for(let i=16;i<64;i++){
      const x=words[i-15],y=words[i-2];
      const s0=ROT(x,7)^ROT(x,18)^(x>>>3);
      const s1=ROT(y,17)^ROT(y,19)^(y>>>10);
      words[i]=(words[i-16]+s0+words[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,j]=h;
    for(let i=0;i<64;i++){
      const s1=ROT(e,6)^ROT(e,11)^ROT(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(j+s1+ch+K[i]+words[i])>>>0;
      const s0=ROT(a,2)^ROT(a,13)^ROT(a,22);
      const maj=(a&b)^(a&c)^(b&c);
      const t2=(s0+maj)>>>0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    const sums=[a,b,c,d,e,f,g,j];for(let i=0;i<8;i++)h[i]=(h[i]+sums[i])>>>0;
  }
  const out=new Uint8Array(32);const result=new DataView(out.buffer);
  for(let i=0;i<8;i++)result.setUint32(i*4,h[i],false);
  return out;
}
export async function sha256Hex(input){
  if(typeof input!=='string')throw new TypeError('SHA-256 expects a UTF-8 string');
  const bytes=new TextEncoder().encode(input);
  const digest=globalThis.crypto?.subtle
    ? new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))
    : sha256Bytes(bytes);
  return [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function secureUUID(){
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  if(typeof globalThis.crypto?.getRandomValues!=='function')throw new Error('A cryptographically secure random source is required');
  const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);
  b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
  const hex=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
