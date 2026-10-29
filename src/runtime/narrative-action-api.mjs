/** Declarative third-party actions compose an explicitly allowed core capability.
 * No extension callback receives documents, journals or an arbitrary effect API.
 * Installed GM code remains trusted code; this does not sandbox JavaScript. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertPlainObject,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const VERSION=/^\d+\.\d+\.\d+$/;
const TARGETS=new Set(['narrative.set-state','narrative.record-world-fact','narrative.set-relationship','narrative.transition-objective','narrative.record-observer-belief']);
const FIELD=/^[a-z][a-zA-Z0-9_]{0,63}$/;
const safeField=key=>FIELD.test(key)&&!['constructor','prototype','actionVersion','actionContract'].includes(key);
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
const scalar=v=>v===null||typeof v==='string'&&v.length<=600||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v);
export class NarrativeActionAPI {
 #providers;#gm;#writer;#actions=new Map();
 constructor({providers,gmProvider,writer}={}){if(!providers?.register||!providers?.get||typeof gmProvider!=='function'||!writer?.assertEligible)fail('ACTION_DEPENDENCY','Core capability registry and designated GM required');this.#providers=providers;this.#gm=gmProvider;this.#writer=writer;}
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);return gm;}
 async register(input){
  this.#authority();assertPlainObject(input,'ACTION_MANIFEST');if(Object.keys(input).some(k=>!['id','version','label','targetProviderId','targetVersion','constants','inputs'].includes(k)))fail('ACTION_MANIFEST','Only a declarative action contract is accepted');const manifest=clone(input),{id,version,label,targetProviderId,targetVersion,constants,inputs}=manifest;
  if(typeof id!=='string'||!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,4}$/.test(id)||id.startsWith('core.')||id.startsWith('narrative.')||id.length>100||!VERSION.test(version??'')||typeof label!=='string'||!label.trim()||label.length>80)fail('ACTION_MANIFEST','Unique non-core action identity, version and label required');
  if(!TARGETS.has(targetProviderId))fail('ACTION_CAPABILITY_DENIED','This action target is not an allowed narrative capability');const target=this.#providers.get(targetProviderId);if(!target||target.version!==targetVersion)fail('ACTION_TARGET_VERSION','Exact available target capability version required');
  assertPlainObject(constants,'ACTION_POLICY');assertPlainObject(inputs,'ACTION_POLICY');if(typeof constants.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(constants.scope)||Object.keys(constants).length>16||Object.keys(inputs).length>12||Object.keys(constants).some(k=>!safeField(k)||!scalar(constants[k]))||Object.keys(inputs).some(k=>!safeField(k)||Object.hasOwn(constants,k)))fail('ACTION_POLICY','A fixed narrative scope and distinct bounded constant/input fields are required');
  for(const rule of Object.values(inputs)){assertPlainObject(rule,'ACTION_POLICY');if(Object.keys(rule).some(k=>!['type','default','enum'].includes(k))||!['string','boolean','number','revision','entity'].includes(rule.type)||!Object.hasOwn(rule,'default'))fail('ACTION_POLICY','Every action input has a declared scalar type and default');if(rule.enum!==undefined&&(!Array.isArray(rule.enum)||!rule.enum.length||rule.enum.length>24||rule.enum.some(v=>!scalar(v))))fail('ACTION_POLICY','Bounded scalar enum required');}
  if(this.#actions.has(id)||this.#providers.has(id))fail('ACTION_DUPLICATE','Action capability is already registered');
  if(new TextEncoder().encode(JSON.stringify(manifest)).length>16000)fail('ACTION_BUDGET','Bounded action manifest required');const contractFingerprint=await sha256Hex(canonical(manifest));this.#authority();
  const validate=payload=>{
   this.#authority();assertPlainObject(payload,'ACTION_PAYLOAD');if(payload.actionVersion!==version||payload.actionContract!==contractFingerprint)fail('ACTION_VERSION','Published action version or contract differs from its registered declaration');const fields=new Set(['actionVersion','actionContract',...Object.keys(constants),...Object.keys(inputs)]);if(Object.keys(payload).some(k=>!fields.has(k))||Object.keys(payload).length!==fields.size)fail('ACTION_PAYLOAD','Action payload must contain exactly its reviewed declared fields');
   for(const [key,value] of Object.entries(constants))if(!Object.is(payload[key],value))fail('ACTION_SCOPE_DENIED','Declared action scope and constants cannot be overridden');
   for(const [key,rule] of Object.entries(inputs)){const v=payload[key],valid=rule.type==='revision'?v===null||Number.isSafeInteger(v)&&v>=1:rule.type==='entity'?typeof v==='string'&&/^ep:[a-z][a-z0-9-]*:[A-Za-z0-9_-]{3,120}$/.test(v):typeof v===rule.type&&scalar(v);if(!valid||rule.enum&&!rule.enum.some(allowed=>Object.is(allowed,v)))fail('ACTION_INPUT','Action input violates its declared type or enum');}
   if(new TextEncoder().encode(JSON.stringify(payload)).length>3500)fail('ACTION_BUDGET','Bounded action payload required');const {actionVersion,actionContract,...effective}=clone(payload);target.validate(effective);this.#authority();return effective;
  };
  const defaultPayload={actionVersion:version,actionContract:contractFingerprint,...constants,...Object.fromEntries(Object.entries(inputs).map(([key,rule])=>[key,rule.default]))};validate(defaultPayload);
  const checkTarget=()=>{this.#authority();if(this.#providers.get(targetProviderId)!==target||target.version!==targetVersion)fail('ACTION_TARGET_VERSION','Registered action target changed');};
  this.#providers.register({id,version,validate:payload=>{validate(payload);},apply:async(payload,context)=>{const effective=validate(payload);checkTarget();const result=await target.apply(effective,context);checkTarget();return result;},verify:async(payload,context)=>{const effective=validate(payload);checkTarget();const result=await target.verify(effective,context);checkTarget();return result;},...(target.get?{get:async payload=>{const effective=validate(payload);checkTarget();const result=await target.get(effective);checkTarget();return result;}}:{})});
  const descriptor={...manifest,contractFingerprint,defaultPayload,capabilities:[{providerId:targetProviderId,version:targetVersion,scope:constants.scope}],apiVersion:'1.0.0'};this.#actions.set(id,descriptor);return clone(descriptor);
 }
 describe(id){this.#authority();return clone(this.#actions.get(id)??null);}
 list(){this.#authority();return [...this.#actions.values()].map(d=>clone(d));}
}
