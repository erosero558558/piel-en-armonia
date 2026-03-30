export function renderDailyAgendaSection() {
    return `
        <section id="daily-agenda" class="admin-section" tabindex="-1">
            <header>
                <div class="header-left">
                    <p>Día en curso</p>
                    <h2>Agenda Diaria</h2>
                </div>
            </header>
            <div id="dailyAgendaUI">
                <!-- Content injected dynamically -->
            </div>
        </section>
    `;
}
