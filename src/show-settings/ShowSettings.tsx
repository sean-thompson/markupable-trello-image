import React from 'react';
import {removeAllMarkupData} from '../api/power-up';
import {useProvidedTrello} from '@optro/ui-react';
import './styles.css';

function ShowSettings() {
    const t = useProvidedTrello();
    return (
        <div className="inner-settings-panel">
            <p>Configure Markupable.</p>
            <button onClick={() => {
                if (confirm('Delete ALL markup data from ALL cards? This cannot be undone.')) {
                    removeAllMarkupData(t);
                }
            }} className="mod-danger">
                Delete All Markup Data
            </button>
        </div>
    );
}

export default ShowSettings;
