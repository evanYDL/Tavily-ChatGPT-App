// Wait for OpenAI SDK to be available
function initializeComponent() {
    console.log('Initializing component...');
    console.log('window.openai available:', !!window.openai);
    console.log('toolOutput:', window.openai?.toolOutput);
    
    const data = window.openai?.toolOutput;
    
    if (!data || !data.company_info) {
        console.log('No company data available yet');
        document.getElementById('company-root').innerHTML = `
            <div class="empty-state">
                <p>Loading company data...</p>
            </div>
        `;
        return;
    }

    console.log('Rendering company card with data:', data.company_info);
    const company = data.company_info;
    renderCompanyCard(company);
}

function renderCompanyCard(company) {
    const root = document.getElementById('company-root');
    
    const newsHtml = company.latest_news_stories && company.latest_news_stories.length > 0
        ? company.latest_news_stories.map(story => `
            <a href="${escapeHtml(story.url || '#')}" 
               target="_blank" 
               class="news-item ${!story.url ? 'disabled' : ''}"
               ${!story.url ? 'onclick="return false;"' : ''}>
                <div class="news-icon-container">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M7 7h10M7 12h10M7 17h10"/>
                    </svg>
                </div>
                <div class="news-content">
                    <div class="news-headline">${escapeHtml(story.headline || 'No headline')}</div>
                    <div class="news-date">${escapeHtml(story.date || 'Date unknown')}</div>
                </div>
            </a>
        `).join('')
        : `<div class="no-news">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span>No recent news</span>
           </div>`;

    root.innerHTML = `
        <div class="company-card">
            <div class="card-header">
                <div class="company-info">
                    <h1 class="company-name">${escapeHtml(company.company_name || 'Unknown Company')}</h1>
                    <div class="ceo-info">CEO: ${escapeHtml(company.ceo || 'N/A')}</div>
                    <div class="location-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>${escapeHtml(company.headquarters || 'N/A')}</span>
                    </div>
                    ${company.description ? `<div class="company-description">${escapeHtml(company.description)}</div>` : ''}
                    <div class="button-row">
                        <a href="${escapeHtml(company.website || '#')}" 
                           target="_blank" 
                           class="btn btn-primary ${!company.website ? 'disabled' : ''}"
                           ${!company.website ? 'onclick="return false;"' : ''}>
                            Website
                        </a>
                        <a href="${escapeHtml(company.linkedin_url || '#')}" 
                           target="_blank" 
                           class="btn btn-outline ${!company.linkedin_url ? 'disabled' : ''}"
                           ${!company.linkedin_url ? 'onclick="return false;"' : ''}>
                            LinkedIn
                        </a>
                    </div>
                </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="news-section">
                <div class="section-caption">Latest news</div>
                <div class="news-list">
                    ${newsHtml}
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Listen for OpenAI SDK events
const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

function handleSetGlobals(event) {
    console.log('Received set_globals event:', event.detail);
    if (event.detail?.globals?.toolOutput !== undefined) {
        console.log('toolOutput updated, re-rendering...');
        initializeComponent();
    }
}

// Initialize when DOM is ready and data is available
function init() {
    console.log('DOM ready, initializing...');
    
    // Listen for updates to toolOutput
    window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobals, { passive: true });
    
    // Initial render
    initializeComponent();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

