import {Trello} from '../types/trello';
import {CapabilityProps} from '../types/power-up';
import {getMarkupData, getAnnotationsForAttachment} from '../api/power-up';
import {isImageAttachment} from '../lib/data-model';

export async function getAttachmentSection(
    t: Trello.PowerUp.IFrame,
    options: { entries: Trello.PowerUp.Attachment[] },
    props: CapabilityProps
): Promise<Trello.PowerUp.AttachmentSection[]> {
    const data = await getMarkupData(t);

    // Filter to image attachments that have annotations
    const claimed = options.entries.filter((attachment: Trello.PowerUp.Attachment) => {
        if (!isImageAttachment(attachment as any)) return false;
        const annotations = getAnnotationsForAttachment(data, attachment.id);
        return annotations.length > 0;
    });

    if (claimed.length > 0) {
        return [{
            claimed: claimed,
            icon: props.baseUrl + props.icon.dark,
            title: 'Marked-up Images',
            content: {
                type: 'iframe',
                url: t.signUrl('./attachment-section.html'),
                height: 230
            }
        }];
    } else {
        throw t.NotHandled();
    }
}
