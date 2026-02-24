import {Trello} from '../types/trello';
import {CapabilityProps} from '../types/power-up';
import {getMarkupData, getAnnotationCount} from '../api/power-up';

async function getDetailBadge(t: Trello.PowerUp.IFrame): Promise<Trello.PowerUp.CardBadge> {
    const data = await getMarkupData(t);
    const count = getAnnotationCount(data);
    if (count === 0) {
        throw t.NotHandled();
    } else {
        return {
            text: `${count} ${count === 1 ? 'Markup' : 'Markups'}`,
            color: 'blue',
            refresh: 10,
        };
    }
}

export function getCardDetailBadge(t: Trello.PowerUp.IFrame, _props: CapabilityProps): Trello.PowerUp.CardDetailBadgeDynamic[] {
    return [{
        dynamic: () => {
            return getDetailBadge(t);
        },
    }];
}
