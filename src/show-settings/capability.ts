import {CapabilityProps} from '../types/power-up';
import {Trello} from '../types/trello';

export function getShowSettings(t: Trello.PowerUp.IFrame, _props: CapabilityProps): any {
    return t.popup({
        title: 'Markupable Settings',
        url: './show-settings',
        height: 150
    });
}
