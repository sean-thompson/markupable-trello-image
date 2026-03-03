import React, {Suspense} from 'react';
import {BrowserRouter as Router, Route} from 'react-router-dom';
import {TrelloProvider} from '@optro/ui-react';

const CardButton = React.lazy(() => import('./card-button/CardButton'));
const ShowSettings = React.lazy(() => import('./show-settings/ShowSettings'));
const AttachmentSection = React.lazy(() => import('./attachment-sections/AttachmentSection'));
const MarkupEditor = React.lazy(() => import('./markup-editor/MarkupEditor'));

const t = window.TrelloPowerUp.iframe({
    appKey: process.env.POWERUP_APP_KEY,
    appName: process.env.POWERUP_NAME
});

function PowerupRouter() {
    return (
        <div>
            <TrelloProvider t={t}>
                <Suspense fallback={<div style={{ margin: '6px' }}>Loading...</div>}>
                    <Router basename={process.env.CONTEXT_PATH || undefined}>
                        <Route path="/attachment-section.html">
                            <AttachmentSection />
                        </Route>
                        <Route path="/card-button.html">
                            <CardButton />
                        </Route>
                        <Route path="/show-settings.html">
                            <ShowSettings />
                        </Route>
                        <Route path="/markup-editor.html">
                            <MarkupEditor />
                        </Route>
                    </Router>
                </Suspense>
            </TrelloProvider>
        </div>
    );
}

export default PowerupRouter;
