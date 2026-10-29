/** Test-only server/document adapter. Persistent mode stores state outside the page. */
export async function createTestStorage({persistent=false}={}){
 const send=async data=>{const response=await fetch('/__foundry-test-storage__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!response.ok)throw Error('Synthetic Foundry storage rejected the operation');return response.json();};
 const initial=persistent?await send({action:'load'}):{settings:[],packs:[]};
 const stored=new Map(initial.settings),packs=new Map();
 const makePack=metadata=>{
  const collection=`world.${metadata.name}`,documents=new Map();
  const read=async id=>persistent?await send({action:'read',collection,id}):structuredClone(documents.get(id)??null);
  const native=data=>({id:data._id,_id:data._id,pack:collection,getFlag:(scope,key)=>structuredClone(data.flags[scope][key]),async update(patch){const next=structuredClone(data);next.flags['easy-plots'].storage=structuredClone(patch['flags.easy-plots.storage']);if(persistent)await send({action:'update',collection,document:next});else documents.set(next._id,next);return native(next);}});
  const pack={collection,metadata:{packageType:'world'},documentName:'JournalEntry',locked:false,getUserLevel:user=>user.isGM?3:0,async configure(options){pack.locked=options.locked??pack.locked;},async getDocuments({_id}){const data=await read(_id);return data?[native(data)]:[];},documentClass:{async createDocuments(rows){const result=[];for(const row of rows){if(await read(row._id))throw Error('duplicate');const data=structuredClone(row);if(persistent)await send({action:'create',collection,document:data});else documents.set(data._id,data);result.push(native(data));}return result;}}};packs.set(collection,pack);return pack;
 };
 for(const metadata of initial.packs)makePack(metadata);
 return {packs,settings:{registerMenu(){},register(ns,key,data){if(!stored.has(key))stored.set(key,structuredClone(data.default));},get(ns,key){return structuredClone(stored.get(key));},async set(ns,key,value){if(persistent)await send({action:'setting',key,value});stored.set(key,structuredClone(value));return value;}},async createCompendium(metadata){if(persistent)await send({action:'pack',metadata});return makePack(metadata);}};
}
