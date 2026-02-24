import {Trello} from '../types/trello';
import {CapabilityProps} from '../types/power-up';
import {getMarkupData, getAnnotationCount} from '../api/power-up';

async function getBadge(t: Trello.PowerUp.IFrame, icon: string): Promise<Trello.PowerUp.CardBadge> {
    const data = await getMarkupData(t);
    const count = getAnnotationCount(data);
    if (count === 0) {
        throw t.NotHandled();
    } else {
        return {
            text: `${count} ${count === 1 ? 'Markup' : 'Markups'}`,
            icon: icon,
            color: 'blue',
            refresh: 10,
        };
    }
}

export function getCardBadge(t: Trello.PowerUp.IFrame, props: CapabilityProps): Trello.PowerUp.CardBadgeDynamic[] {
    return [{
        dynamic: () => {
            return getBadge(t, props.baseUrl + props.icon.light);
        },
    }];
}
