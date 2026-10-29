import {EasyPlotsError} from '../contracts/errors.mjs';
import {createLocalGMContext} from '../security/authority.mjs';
/** This feature gate is deliberately fail-closed until native multiplayer verification. */
export function createFoundrySafetyGates(gameInstance) {
  return {
    isLocalGM:()=>gameInstance?.user?.isGM===true,
    gmContext:()=>createLocalGMContext({user:gameInstance.user,epoch:`${gameInstance.world?.id??'world'}:local`},gameInstance.world?.id??'unknown-world'),
    playerIntentTransport:()=>{throw new EasyPlotsError('SPIKE_SEC_001_REQUIRED','Player intent transport requires native origin/authentication proof');},
    protectedStorage:()=>{throw new EasyPlotsError('SPIKE_STO_001_REQUIRED','GM-restricted document and index visibility requires native verification');},
    crossGMCoordination:()=>{throw new EasyPlotsError('SPIKE_COORD_001_REQUIRED','Cross-GM write fencing requires live native verification');}
  };
}
