/** Pure event-type validator shared by trigger contracts and subscription keys.
 * Kept free of storage/runtime imports to avoid circular module dependencies. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const VALID_EVENT=/^[a-z][a-z0-9.-]{1,100}$/;
export function assertEventType(value){
 if(typeof value!=='string'||!VALID_EVENT.test(value))throw new EasyPlotsError('INVALID_EVENT_TYPE','A supported namespaced event type is required');
 return value;
}
