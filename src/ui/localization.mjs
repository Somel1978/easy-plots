/** Use Foundry's selected language; preserve readable labels outside Foundry. */
export function localize(key,fallback){
  const i18n=globalThis.game?.i18n;
  if(typeof i18n?.localize!=='function')return fallback;
  const text=i18n.localize(key);
  return typeof text==='string'&&text!==key?text:fallback;
}
