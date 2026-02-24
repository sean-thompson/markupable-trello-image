import {Trello} from '../types/trello';
import {CapabilityProps} from '../types/power-up';
import {removeAllMarkupData} from '../api/power-up';

export async function getRemoveData(t: Trello.PowerUp.IFrame, _props: CapabilityProps) {
    await removeAllMarkupData(t);
}
