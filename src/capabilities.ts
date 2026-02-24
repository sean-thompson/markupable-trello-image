import {Trello} from './types/trello';
import {CapabilityProps} from './types/power-up';
import {getCardButton} from './card-button/capability';
import {getCardBadge} from './card-badge/capability';
import {getCardDetailBadge} from './card-detail-badge/capability';
import {getShowSettings} from './show-settings/capability';
import {getOnDisable} from './on-disable/capability';
import {getOnEnable} from './on-enable/capability';
import {getAttachmentSection} from './attachment-sections/capability';
import {getRemoveData} from './remove-data/capability';

const CAPABILITY_PROPS: CapabilityProps = {
    baseUrl: window.location.href.replace(/\/$/, ''),
    icon: {
        dark: '/static/icon-dark.png',
        light: '/static/icon-light.png'
    }
}

window.TrelloPowerUp.initialize({
    'attachment-sections': (t: Trello.PowerUp.IFrame, options: {entries: Trello.PowerUp.Attachment[]}) => getAttachmentSection(t, options, CAPABILITY_PROPS),
    'card-buttons': (t: Trello.PowerUp.IFrame) => getCardButton(t, CAPABILITY_PROPS),
    'card-badges': (t: Trello.PowerUp.IFrame) => getCardBadge(t, CAPABILITY_PROPS),
    'card-detail-badges': (t: Trello.PowerUp.IFrame) => getCardDetailBadge(t, CAPABILITY_PROPS),
    'remove-data': (t: Trello.PowerUp.IFrame) => getRemoveData(t, CAPABILITY_PROPS),
    'show-settings': (t: Trello.PowerUp.IFrame) => getShowSettings(t, CAPABILITY_PROPS),
    'on-enable': (t: Trello.PowerUp.IFrame) => getOnEnable(t, CAPABILITY_PROPS),
    'on-disable': (t: Trello.PowerUp.IFrame) => getOnDisable(t, CAPABILITY_PROPS)
});
