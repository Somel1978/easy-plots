import test from 'node:test';
import assert from 'node:assert/strict';
import {sealPublication,openPublication,validatePublicationEnvelope,randomPublicationNativeId,requirePublicationCrypto,PUBLICATION_BLOCK_BYTES} from '../src/security/publication-envelope.mjs';
const reference={nativeKind:'ChatMessage',nativeId:'PublicationTest1'},view={kind:'knowledge-publication',version:1,title:'A known report',worldTime:20,claims:[{text:'SECRET-SAFE-WORDING-ONLY-FOR-RECIPIENT',stance:'reported'}]};
test('native publication envelopes use fixed-size authenticated ciphertext without plaintext or source metadata',async()=>{
 const first=await sealPublication(view,reference),long=await sealPublication({...view,claims:[{text:'Longer known wording. '.repeat(20),stance:'doubted'}]},reference);
 assert.deepEqual(Object.keys(first.envelope).sort(),['ciphertext','nonce','token','version']);assert.equal(JSON.stringify(first.envelope).includes('SECRET-SAFE'),false);assert.equal(first.envelope.ciphertext.length,long.envelope.ciphertext.length);assert.equal(atob(first.envelope.ciphertext).length,PUBLICATION_BLOCK_BYTES+16);assert.notEqual(first.key,long.key);assert.notEqual(first.envelope.nonce,long.envelope.nonce);
 assert.deepEqual(await openPublication(first.envelope,first.key,reference),view);
});
test('a publication key cannot authenticate another native document, channel, token or modified ciphertext',async()=>{
 const sealed=await sealPublication(view,reference);
 for(const target of [{...reference,nativeId:'PublicationTest2'},{...reference,nativeKind:'JournalEntry'}])await assert.rejects(()=>openPublication(sealed.envelope,sealed.key,target),{code:'PUBLICATION_DECRYPTION'});
 await assert.rejects(()=>openPublication({...sealed.envelope,token:'different-token-001'},sealed.key,reference),{code:'PUBLICATION_DECRYPTION'});
 const raw=Uint8Array.from(atob(sealed.envelope.ciphertext),c=>c.charCodeAt(0));raw[10]^=1;
 await assert.rejects(()=>openPublication({...sealed.envelope,ciphertext:btoa(String.fromCharCode(...raw))},sealed.key,reference),{code:'PUBLICATION_DECRYPTION'});
 const other=await sealPublication(view,reference);await assert.rejects(()=>openPublication(sealed.envelope,other.key,reference),{code:'PUBLICATION_DECRYPTION'});
});
test('unknown cipher versions, injected native metadata and malformed encodings are rejected',async()=>{
 const sealed=await sealPublication(view,reference);
 for(const envelope of [{...sealed.envelope,version:2},{...sealed.envelope,sourceClaimId:'ep:claim:private001'},{...sealed.envelope,nonce:'bad'},{...sealed.envelope,ciphertext:sealed.envelope.ciphertext+'A'}])assert.throws(()=>validatePublicationEnvelope(envelope),{code:'PUBLICATION_ENVELOPE'});
 await assert.rejects(()=>sealPublication({...view,canonicalTruth:'GM-only'},reference),{code:'PUBLICATION_VIEW'});
 await assert.rejects(()=>sealPublication({...view,claims:[{text:'Known words',stance:'reported',sourceId:'ep:claim:private001'}]},reference),{code:'PUBLICATION_VIEW'});
});
test('publication views enforce UTF-8 bounds and encryption snapshots review inputs before asynchronous work',async()=>{
 const input=structuredClone(view),pending=sealPublication(input,reference);input.claims[0].text='Changed after review';const result=await pending;assert.deepEqual(await openPublication(result.envelope,result.key,reference),view);
 await assert.rejects(()=>sealPublication({...view,claims:Array.from({length:8},()=>({text:'界'.repeat(600),stance:'believed'}))},reference),{code:'PUBLICATION_VIEW'});
});
test('unavailable WebCrypto fails closed and generated native identifiers satisfy the host format',()=>{
 assert.throws(()=>requirePublicationCrypto({getRandomValues(){}}),{code:'PUBLICATION_CRYPTO_UNAVAILABLE'});assert.match(randomPublicationNativeId(),/^[A-Za-z0-9]{16}$/);
});
