import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256Bytes,sha256Hex,secureUUID} from '../src/contracts/digest.mjs';
import {opaqueFoundryId} from '../src/storage/native-pack.mjs';

const hex=x=>[...x].map(b=>b.toString(16).padStart(2,'0')).join('');
test('Portable SHA-256 matches standard known vectors',()=>{
  assert.equal(hex(sha256Bytes(new TextEncoder().encode(''))),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hex(sha256Bytes(new TextEncoder().encode('abc'))),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('Portable SHA-256 matches WebCrypto for UTF-8 and longer documents',async()=>{
  for(const s of ['Easy Plots — Narrative Engine','🚀'.repeat(31),'data'.repeat(700)]){
    const expected=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
    assert.equal(hex(sha256Bytes(new TextEncoder().encode(s))),expected);
    assert.equal(await sha256Hex(s),expected);
  }
});
test('Deterministic pack IDs match previous WebCrypto-based format',async()=>{
  const s='ep:record:graph-drafts:main:ep:draft:abc';
  const direct=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).slice(0,16);
  assert.equal(await opaqueFoundryId(s),direct);
});
test('Secure UUID v4 is generated without randomUUID if getRandomValues exists',()=>{
  const id=secureUUID();
  assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
