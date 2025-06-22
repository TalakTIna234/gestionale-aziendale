document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.main-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(btn.dataset.section + '-section').classList.add('active');
        if(btn.dataset.section === 'dashboard') aggiornaDashboardAvanzata();
        if(btn.dataset.section === 'calendario') {
            if (window.calendarChiusure) window.calendarChiusure.render();
        }
    };
});

function updateModernDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('modernDate');
    const timeEl = document.getElementById('modernTime');
    if (!dateEl || !timeEl) return;
    const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('it-IT', optionsDate);
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    timeEl.textContent = now.toLocaleTimeString('it-IT', optionsTime);
    updateTodayRevenue();
}

function updateTodayRevenue() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = localStorage.getItem(`chiusura_${today}`);
    const revenueEl = document.getElementById('todayRevenue');
    if (revenueEl) {
        if (todayData) {
            const data = JSON.parse(todayData);
            revenueEl.textContent = `€${(data.scontrinatoTotale || 0).toFixed(0)}`;
        } else {
            revenueEl.textContent = '€0';
        }
    }
}

function backupData() {
    const allData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        allData[key] = localStorage.getItem(key);
    }
    const dataStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestionale_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('success', 'Backup completato con successo!');
}

function toggleNotifications() {
    showNotification('info', 'Sistema notifiche in arrivo!');
}

function toggleDarkMode() {
    showNotification('info', 'Modalità scura in sviluppo!');
}

function openSettings() {
    showNotification('info', 'Pannello impostazioni in arrivo!');
}

let dashboardCharts = {};

function getPeriodoDateRange(period, year = new Date().getFullYear()) {
    const now = new Date();
    let start, end;
    if (period === 'week') {
        const day = now.getDay() || 7;
        start = new Date(now); start.setDate(now.getDate() - day + 1);
        end = new Date(now); end.setDate(start.getDate() + 6);
    } else if (period === 'month') {
        start = new Date(year, now.getMonth(), 1);
        end = new Date(year, now.getMonth() + 1, 0);
    } else if (period === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(year, quarter * 3, 1);
        end = new Date(year, quarter * 3 + 3, 0);
    } else if (period === 'year') {
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
    } else {
        start = new Date(2000, 0, 1);
        end = new Date(2100, 0, 1);
    }
    return {start, end};
}

function aggiornaDashboardAvanzata() {
    const period = document.getElementById('dashboardPeriod')?.value || 'month';
    const year = parseInt(document.getElementById('dashboardYear')?.value || new Date().getFullYear());
    const {start, end} = getPeriodoDateRange(period, year);
    const datiFinanziari = raccogliDatiFinanziari(start, end);
    aggiornaKPI(datiFinanziari);
    aggiornaSezioniDettagliate(datiFinanziari);
    aggiornaGrafici(datiFinanziari, period, year);
    generaAlert(datiFinanziari);
    calcolaPrevisioni(datiFinanziari);
}

function raccogliDatiFinanziari(start, end) {
    let chiusure = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('chiusura_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const d = new Date(data.data);
                if (d >= start && d <= end) chiusure.push(data);
            } catch (e) {}
        }
    }
    let fatture = JSON.parse(localStorage.getItem('fatture') || '[]');
    fatture = fatture.filter(f => new Date(f.data) >= start && new Date(f.data) <= end);
    let ricorrenze = JSON.parse(localStorage.getItem('ricorrenze') || '[]');
    const ricaviCassa = chiusure.reduce((sum, c) => sum + (c.scontrinatoTotale || 0), 0);
    const entrateRicorrenti = calcolaRicorrenze(ricorrenze, 'entrata', start, end);
    const usciteRicorrenti = calcolaRicorrenze(ricorrenze, 'uscita', start, end);
    const fatturepagate = fatture.filter(f => f.stato === 'pagata').reduce((sum, f) => sum + f.importo, 0);
    const fatturePendenti = fatture.filter(f => f.stato === 'da pagare').reduce((sum, f) => sum + f.importo, 0);
    const fattureScadute = fatture.filter(f => {
        const scadenza = new Date(f.scadenza);
        return f.stato === 'da pagare' && scadenza < new Date();
    }).reduce((sum, f) => sum + f.importo, 0);
    const totaleEntrate = ricaviCassa + entrateRicorrenti;
    const totaleUscite = fatturepagate + usciteRicorrenti;
    const utileNetto = totaleEntrate - totaleUscite;
    const ivaVendite = ricaviCassa * 0.22;
    const ivaAcquisti = fatturepagate * 0.22;
    const ivaNettaDaVersare = Math.max(0, ivaVendite - ivaAcquisti);
    return {
        chiusure, fatture, ricorrenze, ricaviCassa, entrateRicorrenti, usciteRicorrenti,
        fatturepagate, fatturePendenti, fattureScadute, totaleEntrate, totaleUscite,
        utileNetto, ivaVendite, ivaAcquisti, ivaNettaDaVersare, start, end
    };
}

function calcolaRicorrenze(ricorrenze, tipo, start, end) {
    let totale = 0;
    const giorni = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    ricorrenze.filter(r => r.tipo === tipo).forEach(r => {
        let occorrenze = 0;
        if (r.frequenza === 'mensile') {
            occorrenze = Math.ceil(giorni / 30);
        } else if (r.frequenza === 'settimanale') {
            occorrenze = Math.ceil(giorni / 7);
        } else if (r.frequenza === 'annuale') {
            occorrenze = Math.ceil(giorni / 365);
        }
        totale += r.importo * occorrenze;
    });
    return totale;
}

function aggiornaKPI(dati) {
    const totalRevenue = document.getElementById('totalRevenue');
    const totalExpenses = document.getElementById('totalExpenses');
    const netProfit = document.getElementById('netProfit');
    const vatToPay = document.getElementById('vatToPay');
    if (totalRevenue) totalRevenue.textContent = `€${dati.totaleEntrate.toFixed(2)}`;
    if (totalExpenses) totalExpenses.textContent = `€${dati.totaleUscite.toFixed(2)}`;
    if (netProfit) netProfit.textContent = `€${dati.utileNetto.toFixed(2)}`;
    if (vatToPay) vatToPay.textContent = `€${dati.ivaNettaDaVersare.toFixed(2)}`;
}

function aggiornaSezioniDettagliate(dati) {
    const elements = {
        'cashRevenue': dati.ricaviCassa,
        'recurringRevenue': dati.entrateRicorrenti,
        'paidInvoices': dati.fatturepagate,
        'pendingInvoices': dati.fatturePendenti,
        'recurringExpenses': dati.usciteRicorrenti,
        'overdueInvoices': dati.fattureScadute,
        'salesVat': dati.ivaVendite,
        'purchaseVat': dati.ivaAcquisti,
        'netVat': dati.ivaNettaDaVersare
    };
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `€${value.toFixed(2)}`;
    });
}

function calcolaPrevisioni(dati) {
    const obiettivo = 50000;
    const raggiuntoPerc = Math.min(100, (dati.totaleEntrate / obiettivo) * 100);
    const monthlyTarget = document.getElementById('monthlyTarget');
    const targetAchievement = document.getElementById('targetAchievement');
    const targetProgress = document.getElementById('targetProgress');
    if (monthlyTarget) monthlyTarget.textContent = `€${obiettivo.toLocaleString()}`;
    if (targetAchievement) targetAchievement.textContent = `${raggiuntoPerc.toFixed(1)}%`;
    if (targetProgress) targetProgress.style.width = `${raggiuntoPerc}%`;
}

function aggiornaGrafici(dati, period, year) {
    Object.values(dashboardCharts).forEach(chart => {
        if (chart && chart.destroy) chart.destroy();
    });
    if (typeof Chart !== 'undefined') {
        creaGraficoAndamentoMensile(dati, year);
        creaGraficoDistribuzioneEntrate(dati);
        creaGraficoAnalisiSpese(dati);
        creaGraficoTrendIVA(dati, year);
    }
}

function creaGraficoAndamentoMensile(dati, year) {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const entratePerMese = new Array(12).fill(0);
    const uscitePerMese = new Array(12).fill(0);
    for (let mese = 0; mese < 12; mese++) {
        const inizioMese = new Date(year, mese, 1);
        const fineMese = new Date(year, mese + 1, 0);
        const datiMese = raccogliDatiFinanziari(inizioMese, fineMese);
        entratePerMese[mese] = datiMese.totaleEntrate;
        uscitePerMese[mese] = datiMese.totaleUscite;
    }
    dashboardCharts.monthlyTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: mesi,
            datasets: [{
                label: 'Entrate',
                data: entratePerMese,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Uscite',
                data: uscitePerMese,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: function(value) { return '€' + value.toLocaleString(); } }
                }
            }
        }
    });
}

function creaGraficoDistribuzioneEntrate(dati) {
    const ctx = document.getElementById('revenueDistributionChart');
    if (!ctx || typeof Chart === 'undefined') return;
    dashboardCharts.revenueDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Scontrinato Cassa', 'Entrate Ricorrenti'],
            datasets: [{
                data: [dati.ricaviCassa, dati.entrateRicorrenti],
                backgroundColor: ['#667eea', '#764ba2'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function creaGraficoAnalisiSpese(dati) {
    const ctx = document.getElementById('expensesAnalysisChart');
    if (!ctx || typeof Chart === 'undefined') return;
    dashboardCharts.expensesAnalysis = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Fatture Pagate', 'Fatture Pendenti', 'Fatture Scadute', 'Spese Ricorrenti'],
            datasets: [{
                label: 'Importo (€)',
                data: [dati.fatturepagate, dati.fatturePendenti, dati.fattureScadute, dati.usciteRicorrenti],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: function(value) { return '€' + value.toLocaleString(); } }
                }
            }
        }
    });
}

function creaGraficoTrendIVA(dati, year) {
    const ctx = document.getElementById('vatTrendChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const mesi = [];
    const ivaData = [];
    for (let i = 5; i >= 0; i--) {
        const data = new Date();
        data.setMonth(data.getMonth() - i);
        mesi.push(data.toLocaleDateString('it-IT', { month: 'short' }));
        const inizioMese = new Date(data.getFullYear(), data.getMonth(), 1);
        const fineMese = new Date(data.getFullYear(), data.getMonth() + 1, 0);
        const datiMese = raccogliDatiFinanziari(inizioMese, fineMese);
        ivaData.push(datiMese.ivaNettaDaVersare);
    }
    dashboardCharts.vatTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: mesi,
            datasets: [{
                label: 'IVA da Versare',
                data: ivaData,
                borderColor: '#ffc107',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: function(value) { return '€' + value.toLocaleString(); } }
                }
            }
        }
    });
}

function generaAlert(dati) {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    const alerts = [];
    if (dati.fattureScadute > 0) {
        alerts.push({
            type: 'danger',
            icon: '🚨',
            message: `Hai fatture scadute per un totale di €${dati.fattureScadute.toFixed(2)}!`
        });
    }
    if (dati.ivaNettaDaVersare > 5000) {
        alerts.push({
            type: 'warning',
            icon: '⚠️',
            message: `IVA da versare elevata: €${dati.ivaNettaDaVersare.toFixed(2)}. Prossima scadenza: 16 del mese.`
        });
    }
    const obiettivo = 50000;
    if (dati.totaleEntrate >= obiettivo) {
        alerts.push({
            type: 'success',
            icon: '🎉',
            message: `Congratulazioni! Hai raggiunto l'obiettivo mensile di €${obiettivo.toLocaleString()}!`
        });
    }
    if (dati.fatturePendenti > 10000) {
        alerts.push({
            type: 'info',
            icon: 'ℹ️',
            message: `Hai fatture pendenti per €${dati.fatturePendenti.toFixed(2)}. Controlla le scadenze.`
        });
    }
    container.innerHTML = alerts.length > 0 
        ? alerts.map(alert => `
            <div class="alert ${alert.type}">
                <span>${alert.icon}</span>
                <span>${alert.message}</span>
            </div>
        `).join('')
        : '<div class="alert success"><span>✅</span><span>Tutto sotto controllo! Nessun alert da segnalare.</span></div>';
}

let fornitori = JSON.parse(localStorage.getItem('fornitori') || '["Fornitore Esempio"]');
function caricaFornitori() {
    const fornitoreSelect = document.getElementById('fornitore');
    const filtroFornitore = document.getElementById('filtroFornitore');
    const fornitoriList = document.getElementById('fornitoriList');
    if (fornitoreSelect) {
        fornitoreSelect.innerHTML = '<option value="">Seleziona fornitore...</option>';
        fornitori.forEach(f => {
            const option = document.createElement('option');
            option.value = f;
            option.textContent = f;
            fornitoreSelect.appendChild(option);
        });
    }
    if (filtroFornitore) {
        filtroFornitore.innerHTML = '<option value="">Tutti i fornitori</option>';
        fornitori.forEach(f => {
            const option = document.createElement('option');
            option.value = f;
            option.textContent = f;
            filtroFornitore.appendChild(option);
        });
    }
    if (fornitoriList) {
        fornitoriList.innerHTML = fornitori.map(f => `
            <div class="fornitore-tag">
                ${f}
                <button class="remove-btn" onclick="rimuoviFornitore('${f}')">&times;</button>
            </div>
        `).join('');
    }
}
function aggiungiFornitore() {
    const input = document.getElementById('nuovoFornitore');
    const nome = input.value.trim();
    if (nome && !fornitori.includes(nome)) {
        fornitori.push(nome);
        localStorage.setItem('fornitori', JSON.stringify(fornitori));
        caricaFornitori();
        input.value = '';
        showNotification('success', `Fornitore "${nome}" aggiunto con successo!`);
    } else if (fornitori.includes(nome)) {
        showNotification('warning', 'Fornitore già esistente!');
    }
}
function rimuoviFornitore(nome) {
    if (confirm(`Rimuovere il fornitore "${nome}"?`)) {
        fornitori = fornitori.filter(f => f !== nome);
        localStorage.setItem('fornitori', JSON.stringify(fornitori));
        caricaFornitori();
        mostraFatture();
        showNotification('info', `Fornitore "${nome}" rimosso.`);
    }
}

let fatture = JSON.parse(localStorage.getItem('fatture') || '[]');
let fatturaInModifica = null;
function salvaFattura(e) {
    e.preventDefault();
    const id = document.getElementById('fatturaId').value || Date.now();
    const nuovaFattura = {
        id,
        fornitore: document.getElementById('fornitore').value,
        importo: parseFloat(document.getElementById('importoFattura').value),
        descrizione: document.getElementById('descrizioneFattura').value,
        data: document.getElementById('dataFattura').value,
        scadenza: document.getElementById('scadenzaFattura').value,
        modalita: document.getElementById('modalitaPagamento').value,
        stato: document.getElementById('statoFattura').value,
        dataCreazione: fatturaInModifica ? fatturaInModifica.dataCreazione : new Date().toISOString()
    };
    const idx = fatture.findIndex(f => f.id == id);
    if (idx > -1) {
        fatture[idx] = nuovaFattura;
        showNotification('success', 'Fattura aggiornata con successo!');
    } else {
        fatture.push(nuovaFattura);
        showNotification('success', 'Fattura salvata con successo!');
    }
    localStorage.setItem('fatture', JSON.stringify(fatture));
    mostraFatture();
    resetFatturaForm();
    if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
        aggiornaDashboardAvanzata();
    }
}
function modificaFattura(id) {
    const fattura = fatture.find(f => f.id == id);
    if (!fattura) return;
    fatturaInModifica = fattura;
    document.getElementById('fatturaId').value = fattura.id;
    document.getElementById('fornitore').value = fattura.fornitore;
    document.getElementById('importoFattura').value = fattura.importo;
    document.getElementById('descrizioneFattura').value = fattura.descrizione;
    document.getElementById('dataFattura').value = fattura.data;
    document.getElementById('scadenzaFattura').value = fattura.scadenza;
    document.getElementById('modalitaPagamento').value = fattura.modalita;
    document.getElementById('statoFattura').value = fattura.stato;
    document.getElementById('fatturaForm').scrollIntoView({ behavior: 'smooth' });
    showNotification('info', 'Fattura caricata per la modifica');
}
function eliminaFattura(id) {
    const fattura = fatture.find(f => f.id == id);
    if (!fattura) return;
    if (confirm(`Eliminare la fattura di ${fattura.fornitore} per €${fattura.importo.toFixed(2)}?`)) {
        fatture = fatture.filter(f => f.id != id);
        localStorage.setItem('fatture', JSON.stringify(fatture));
        mostraFatture();
        showNotification('info', 'Fattura eliminata');
        if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
            aggiornaDashboardAvanzata();
        }
    }
}
function resetFatturaForm() {
    document.getElementById('fatturaForm').reset();
    document.getElementById('fatturaId').value = '';
    fatturaInModifica = null;
}

function mostraFatture() {
    const list = document.getElementById('fattureList');
    if (!list) return;
    let fattureFiltered = [...fatture];
    const filtroStato = document.getElementById('filtroStato')?.value;
    const filtroFornitore = document.getElementById('filtroFornitore')?.value;
    const filtroRicerca = document.getElementById('filtroRicerca')?.value.toLowerCase();
    if (filtroStato) {
        fattureFiltered = fattureFiltered.filter(f => f.stato === filtroStato);
    }
    if (filtroFornitore) {
        fattureFiltered = fattureFiltered.filter(f => f.fornitore === filtroFornitore);
    }
    if (filtroRicerca) {
        fattureFiltered = fattureFiltered.filter(f => 
            f.descrizione.toLowerCase().includes(filtroRicerca) ||
            f.fornitore.toLowerCase().includes(filtroRicerca)
        );
    }
    if (fattureFiltered.length === 0) {
        list.innerHTML = '<div class="empty-state">📄 Nessuna fattura trovata</div>';
        return;
    }
    fattureFiltered.sort((a, b) => new Date(b.data) - new Date(a.data));
    list.innerHTML = fattureFiltered.map(f => {
        const dataScadenza = new Date(f.scadenza);
        const oggi = new Date();
        const isScaduta = dataScadenza < oggi && f.stato === 'da pagare';
        const statusClass = f.stato === 'pagata' ? 'pagata' : (isScaduta ? 'scaduta' : 'da-pagare');
        const cardClass = f.stato === 'pagata' ? 'pagata' : (isScaduta ? 'scaduta' : '');
        return `
            <div class="fattura-card ${cardClass}">
                <div class="fattura-status ${statusClass}">
                    ${f.stato === 'pagata' ? '✅ Pagata' : (isScaduta ? '🚨 Scaduta' : '⏳ Da Pagare')}
                </div>
                <div class="fattura-header">
                    <div class="fattura-fornitore">${f.fornitore}</div>
                    <div class="fattura-importo">€${f.importo.toFixed(2)}</div>
                </div>
                <div class="fattura-details">
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Descrizione</div>
                        <div class="fattura-detail-value">${f.descrizione || 'N/A'}</div>
                    </div>
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Data Fattura</div>
                        <div class="fattura-detail-value">${new Date(f.data).toLocaleDateString('it-IT')}</div>
                    </div>
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Scadenza</div>
                        <div class="fattura-detail-value">${new Date(f.scadenza).toLocaleDateString('it-IT')}</div>
                    </div>
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Pagamento</div>
                        <div class="fattura-detail-value">${f.modalita}</div>
                    </div>
                </div>
                <div class="fattura-actions">
                    <button class="btn-edit" onclick="modificaFattura(${f.id})">✏️ Modifica</button>
                    <button class="btn-delete" onclick="eliminaFattura(${f.id})">🗑️ Elimina</button>
                </div>
            </div>
        `;
    }).join('');
}

let ricorrenze = JSON.parse(localStorage.getItem('ricorrenze') || '[]');
function salvaRicorrenza(e) {
    e.preventDefault();
    const id = document.getElementById('ricorrenzaId').value || Date.now();
    const nuovaRic = {
        id,
        tipo: document.getElementById('tipoRicorrenza').value,
        nome: document.getElementById('nomeRicorrenza').value,
        importo: parseFloat(document.getElementById('importoRicorrenza').value),
        frequenza: document.getElementById('frequenzaRicorrenza').value
    };
    const idx = ricorrenze.findIndex(r => r.id == id);
    if (idx > -1) ricorrenze[idx] = nuovaRic; else ricorrenze.push(nuovaRic);
    localStorage.setItem('ricorrenze', JSON.stringify(ricorrenze));
    mostraRicorrenze();
    e.target.reset();
    if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
        aggiornaDashboardAvanzata();
    }
}
function mostraRicorrenze() {
    const list = document.getElementById('ricorrenzeList');
    if (list) {
        list.innerHTML = ricorrenze.length
            ? ricorrenze.map(r => `<div class="ricorrenza-item">
                <b>${r.tipo == 'entrata' ? 'Entrata' : 'Uscita'}</b>: ${r.nome} - €${r.importo.toFixed(2)} (${r.frequenza})
            </div>`).join('')
            : '<em>Nessuna ricorrenza registrata</em>';
    }
}

function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease;
        background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#17a2b8'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}

function aggiornaDataOra() {
    const now = new Date();
    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('it-IT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('it-IT');
    }
}

class CalendarChiusure {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        window.calendarChiusure = this;
        this.init();
    }
    init() {
        this.grid = document.getElementById('calendarGrid');
        this.monthLabel = document.getElementById('calendarMonth');
        this.details = document.getElementById('calendarDetails');
        this.detailsContent = document.getElementById('calendarDetailsContent');
        if (!this.grid || !this.monthLabel) return;
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        const printBtn = document.getElementById('printClosure');
        const exportBtn = document.getElementById('exportClosure');
        if (prevBtn) prevBtn.onclick = () => this.changeMonth(-1);
        if (nextBtn) nextBtn.onclick = () => this.changeMonth(1);
        if (printBtn) printBtn.onclick = () => window.print();
        if (exportBtn) exportBtn.onclick = () => this.exportClosure();
        this.render();
    }
    render() {
        if (!this.grid || !this.monthLabel) return;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.monthLabel.textContent = this.currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        this.grid.innerHTML = '';
        days.forEach(d => {
            const el = document.createElement('div');
            el.className = 'calendar-header';
            el.textContent = d;
            this.grid.appendChild(el);
        });
        const first = new Date(year, month, 1);
        const startDay = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < startDay; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day other-month';
            this.grid.appendChild(el);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateKey = date.toISOString().split('T')[0];
            const el = document.createElement('div');
            el.className = 'calendar-day';
            if (this.isToday(date)) el.classList.add('today');
            if (localStorage.getItem(`chiusura_${dateKey}`)) el.classList.add('has-data');
            el.textContent = d;
            el.onclick = () => this.showDetails(date);
            this.grid.appendChild(el);
        }
    }
    changeMonth(delta) {
        const newMonth = this.currentDate.getMonth() + delta;
        const newYear = this.currentDate.getFullYear();
        if (newMonth < 0) {
            this.currentDate = new Date(newYear - 1, 11, 1);
        } else if (newMonth > 11) {
            this.currentDate = new Date(newYear + 1, 0, 1);
        } else {
            this.currentDate = new Date(newYear, newMonth, 1);
        }
        this.render();
        if (this.details) this.details.style.display = 'none';
    }
    isToday(date) {
        const now = new Date();
        return date.getDate() === now.getDate() &&
               date.getMonth() === now.getMonth() &&
               date.getFullYear() === now.getFullYear();
    }
    showDetails(date) {
        const dateKey = date.toISOString().split('T')[0];
        const data = localStorage.getItem(`chiusura_${dateKey}`);
        if (!data) {
            if (this.details) this.details.style.display = 'none';
            return;
        }
        const chiusura = JSON.parse(data);
        if (this.detailsContent) {
            this.detailsContent.textContent = `
Data: ${date.toLocaleDateString('it-IT')}
Scontrinato Totale: €${chiusura.scontrinatoTotale?.toFixed(2) || '0.00'}
Contanti: €${chiusura.scontrinatoContanti?.toFixed(2) || '0.00'}
POS: €${chiusura.scontrinatoPos?.toFixed(2) || '0.00'}
Art. 74: €${chiusura.art74?.toFixed(2) || '0.00'}
Art. 22: €${chiusura.art22?.toFixed(2) || '0.00'}
Drop POS: €${chiusura.dropPos?.toFixed(2) || '0.00'}
Drop Cash: €${chiusura.dropCash?.toFixed(2) || '0.00'}
Monete Precedenti: €${chiusura.moneteGiornoPrecedente?.toFixed(2) || '0.00'}
Monete Attuali: €${chiusura.moneteAttuali?.toFixed(2) || '0.00'}
Fondo Cassa: €${chiusura.fondoCassa?.toFixed(2) || '0.00'}
Status: ${chiusura.status?.toUpperCase() || ''}
            `.trim();
        }
        if (this.details) this.details.style.display = 'block';
        this.selectedDate = date;
    }
    exportClosure() {
        if (!this.selectedDate) return;
        const dateKey = this.selectedDate.toISOString().split('T')[0];
        const data = localStorage.getItem(`chiusura_${dateKey}`);
        if (!data) return;
        const blob = new Blob([this.detailsContent.textContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `chiusura_${dateKey}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

class CassaCalendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        window.cassaCalendar = this;
        this.init();
    }
    init() {
        this.grid = document.getElementById('cassaCalendarGrid');
        this.monthLabel = document.getElementById('cassaCalendarMonth');
        this.selectedDateDisplay = document.getElementById('selectedDateDisplay');
        if (!this.grid || !this.monthLabel) return;
        const prevBtn = document.getElementById('cassaPrevMonth');
        const nextBtn = document.getElementById('cassaNextMonth');
        if (prevBtn) prevBtn.onclick = () => this.changeMonth(-1);
        if (nextBtn) nextBtn.onclick = () => this.changeMonth(1);
        this.render();
        this.updateSelectedDateDisplay();
    }
    render() {
        if (!this.grid || !this.monthLabel) return;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.monthLabel.textContent = this.currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        this.grid.innerHTML = '';
        days.forEach(d => {
            const el = document.createElement('div');
            el.className = 'cassa-calendar-header';
            el.textContent = d;
            this.grid.appendChild(el);
        });
        const first = new Date(year, month, 1);
        const startDay = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < startDay; i++) {
            const el = document.createElement('div');
            el.className = 'cassa-calendar-day other-month';
            this.grid.appendChild(el);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateKey = date.toISOString().split('T')[0];
            const el = document.createElement('div');
            el.className = 'cassa-calendar-day';
            if (this.isToday(date)) el.classList.add('today');
            if (this.isSelected(date)) el.classList.add('selected');
            if (localStorage.getItem(`chiusura_${dateKey}`)) el.classList.add('has-data');
            el.textContent = d;
            el.onclick = () => this.selectDate(date);
            this.grid.appendChild(el);
        }
    }
    changeMonth(delta) {
        const newMonth = this.currentDate.getMonth() + delta;
        const newYear = this.currentDate.getFullYear();
        if (newMonth < 0) {
            this.currentDate = new Date(newYear - 1, 11, 1);
        } else if (newMonth > 11) {
            this.currentDate = new Date(newYear + 1, 0, 1);
        } else {
            this.currentDate = new Date(newYear, newMonth, 1);
        }
        this.render();
    }
    isToday(date) {
        const now = new Date();
        return date.getDate() === now.getDate() &&
               date.getMonth() === now.getMonth() &&
               date.getFullYear() === now.getFullYear();
    }
    isSelected(date) {
        return this.selectedDate &&
               date.getDate() === this.selectedDate.getDate() &&
               date.getMonth() === this.selectedDate.getMonth() &&
               date.getFullYear() === this.selectedDate.getFullYear();
    }
    selectDate(date) {
        this.selectedDate = new Date(date);
        this.render();
        this.updateSelectedDateDisplay();
        if (window.chiusuraCassaSystem) {
            window.chiusuraCassaSystem.changeEditDate(date);
        }
    }
    updateSelectedDateDisplay() {
        if (!this.selectedDateDisplay || !this.selectedDate) return;
        const dateStr = this.selectedDate.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const isToday = this.isToday(this.selectedDate);
        this.selectedDateDisplay.textContent = `Data selezionata: ${dateStr} ${isToday ? '(OGGI)' : ''}`;
    }
}

class ChiusuraCassaSystem {
    constructor() {
        this.currentEditDate = new Date();
        window.chiusuraCassaSystem = this;
        this.initializeElements();
        this.loadStoredData();
        this.setupEventListeners();
        this.updateDateTime();
        this.updateCountdown();
        setInterval(() => {
            this.updateDateTime();
            this.updateCountdown();
        }, 60000);
    }
    changeEditDate(newDate) {
        this.currentEditDate = new Date(newDate);
        this.loadStoredData();
        this.updateFondoCassaLive();
    }
    initializeElements() {
        this.form = document.getElementById('chiusuraCassaForm');
        this.scontrinatoTotale = document.getElementById('scontrinatoTotale');
        this.scontrinatoContanti = document.getElementById('scontrinatoContanti');
        this.scontrinatoPos = document.getElementById('scontrinatoPos');
        this.art74 = document.getElementById('art74');
        this.art22 = document.getElementById('art22');
        this.dropPos = document.getElementById('dropPos');
        this.dropCash = document.getElementById('dropCash');
        this.moneteGiornoPrecedente = document.getElementById('moneteGiornoPrecedente');
        this.moneteAttuali = document.getElementById('moneteAttuali');
        this.totaleContantiCassa = document.getElementById('totaleContantiCassa');
        this.verificationResult = document.getElementById('verificationResult');
        this.articoliVerification = document.getElementById('articoliVerification');
        this.differenzaMonete = document.getElementById('differenzaMonete');
        this.fondoCassaResult = document.getElementById('fondoCassaResult');
        this.fondoCassaInterpretation = document.getElementById('fondoCassaInterpretation');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.plafondFill = document.getElementById('plafondFill');
        this.countdown = document.getElementById('countdown');
        this.verificaCompleta = document.getElementById('verificaCompleta');
        this.salvaBtn = document.getElementById('salvaBtn');
        this.esportaBtn = document.getElementById('esportaBtn');
        this.modal = document.getElementById('modal');
        this.modalBody = document.getElementById('modalBody');
    }
    loadStoredData() {
        const yesterday = new Date(this.currentEditDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = this.getDateKey(yesterday);
        const yesterdayData = localStorage.getItem(`chiusura_${yesterdayKey}`);
        if (this.moneteGiornoPrecedente) {
            if (yesterdayData) {
                const data = JSON.parse(yesterdayData);
                this.moneteGiornoPrecedente.value = data.moneteAttuali || 70;
            } else {
                this.moneteGiornoPrecedente.value = 70;
            }
        }
        const currentKey = this.getDateKey(this.currentEditDate);
        const currentData = localStorage.getItem(`chiusura_${currentKey}`);
        if (currentData) {
            const data = JSON.parse(currentData);
            if (this.scontrinatoTotale) this.scontrinatoTotale.value = data.scontrinatoTotale || '';
            if (this.scontrinatoContanti) this.scontrinatoContanti.value = data.scontrinatoContanti || '';
            if (this.scontrinatoPos) this.scontrinatoPos.value = data.scontrinatoPos || '';
            if (this.art74) this.art74.value = data.art74 || '';
            if (this.art22) this.art22.value = data.art22 || '';
            if (this.dropPos) this.dropPos.value = data.dropPos || '';
            if (this.dropCash) this.dropCash.value = data.dropCash || '';
            if (this.moneteAttuali) this.moneteAttuali.value = data.moneteAttuali || '';
            if (this.totaleContantiCassa) this.totaleContantiCassa.value = data.totaleContantiCassa || '';
        } else {
            if (this.scontrinatoTotale) this.scontrinatoTotale.value = '';
            if (this.scontrinatoContanti) this.scontrinatoContanti.value = '';
            if (this.scontrinatoPos) this.scontrinatoPos.value = '';
            if (this.art74) this.art74.value = '';
            if (this.art22) this.art22.value = '';
            if (this.dropPos) this.dropPos.value = '';
            if (this.dropCash) this.dropCash.value = '';
            if (this.moneteAttuali) this.moneteAttuali.value = '';
            if (this.totaleContantiCassa) this.totaleContantiCassa.value = '';
        }
        this.updateFondoCassaLive();
    }
    setupEventListeners() {
        const inputs = [
            this.scontrinatoTotale, this.scontrinatoContanti, this.scontrinatoPos,
            this.art74, this.art22, this.dropPos, this.dropCash,
            this.moneteGiornoPrecedente, this.moneteAttuali, this.totaleContantiCassa
        ].filter(Boolean);
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateFondoCassaLive());
        });
        if (this.verificaCompleta) this.verificaCompleta.addEventListener('click', () => this.verificaCompleta_Click());
        if (this.form) this.form.addEventListener('submit', (e) => this.salvaChiusura(e));
        if (this.esportaBtn) this.esportaBtn.addEventListener('click', () => this.esportaReport());
        const closeBtn = document.querySelector('.close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
    }
    updateFondoCassaLive() {
        const scontrinatoCash = parseFloat(this.scontrinatoContanti?.value) || 0;
        const dropCash = parseFloat(this.dropCash?.value) || 0;
        const totaleContanti = parseFloat(this.totaleContantiCassa?.value) || 0;
        const moneteAttuali = parseFloat(this.moneteAttuali?.value) || 0;
        const moneteGiornoPrecedente = parseFloat(this.moneteGiornoPrecedente?.value) || 0;
        const differenzaMonete = moneteAttuali - moneteGiornoPrecedente;
        if (this.differenzaMonete) {
            this.differenzaMonete.textContent = (differenzaMonete >= 0 ? "+" : "") + "€" + differenzaMonete.toFixed(2) + (differenzaMonete > 0 ? " (Esubero)" : (differenzaMonete < 0 ? " (Ammanco)" : ""));
        }
        const fondoCassa = totaleContanti - scontrinatoCash - dropCash + differenzaMonete - 100;
        if (this.fondoCassaResult) {
            this.fondoCassaResult.textContent = `€${fondoCassa.toFixed(2)}`;
        }
        let statusText = '';
        let statusClass = '';
        if (Math.abs(fondoCassa) < 0.01) {
            statusText = '✅ Perfetto equilibrio';
            statusClass = 'perfect';
        } else if (fondoCassa > 0) {
            if (fondoCassa <= 10) {
                statusText = '⚠️ Leggero esubero';
                statusClass = 'warning';
            } else {
                statusText = '🚨 Esubero significativo';
                statusClass = 'danger';
            }
        } else {
            if (fondoCassa >= -10) {
                statusText = '⚠️ Leggero ammanco';
                statusClass = 'warning';
            } else {
                statusText = '🚨 Ammanco significativo';
                statusClass = 'danger';
            }
        }
        if (this.fondoCassaInterpretation) {
            this.fondoCassaInterpretation.textContent = statusText;
            this.fondoCassaInterpretation.className = `result-interpretation ${statusClass}`;
        }
    }
    verificaCompleta_Click() {
        this.verificaScontrinato();
        this.verificaArticoli();
        this.updateFondoCassaLive();
        this.updateDropPosStatus();
        const hasCalculationErrors = (this.verificationResult?.classList.contains('error') || false) ||
                                   (this.articoliVerification?.classList.contains('error') || false);
        if (hasCalculationErrors) {
            this.showModal('warning', 'Avvisi Rilevati', 
                'Ci sono alcuni avvisi nei calcoli, ma puoi comunque salvare la chiusura.');
        } else {
            this.showModal('success', 'Verifica Completata', 
                'Tutti i controlli sono stati superati! Puoi salvare la chiusura.');
        }
    }
    verificaScontrinato() {
        const totale = parseFloat(this.scontrinatoTotale?.value) || 0;
        const contanti = parseFloat(this.scontrinatoContanti?.value) || 0;
        const pos = parseFloat(this.scontrinatoPos?.value) || 0;
        if (!this.verificationResult) return;
        if (totale === 0 && contanti === 0 && pos === 0) {
            this.verificationResult.style.display = 'none';
            return;
        }
        const somma = contanti + pos;
        const differenza = Math.abs(totale - somma);
        this.verificationResult.style.display = 'block';
        if (differenza < 0.01) {
            this.verificationResult.className = 'verification-result success';
            this.verificationResult.innerHTML = '✅ Scontrinato verificato correttamente';
        } else {
            this.verificationResult.className = 'verification-result error';
            this.verificationResult.innerHTML = 
                `❌ AVVISO: Discrepanza scontrinato! Differenza: €${differenza.toFixed(2)}`;
        }
    }
    verificaArticoli() {
        const scontrinatoTotale = parseFloat(this.scontrinatoTotale?.value) || 0;
        const art74 = parseFloat(this.art74?.value) || 0;
        const art22 = parseFloat(this.art22?.value) || 0;
        if (!this.articoliVerification) return;
        if (scontrinatoTotale === 0 && art74 === 0 && art22 === 0) {
            this.articoliVerification.style.display = 'none';
            return;
        }
        const sommaArticoli = art74 + art22;
        const differenza = Math.abs(scontrinatoTotale - sommaArticoli);
        this.articoliVerification.style.display = 'block';
        if (differenza < 0.01) {
            this.articoliVerification.className = 'articoli-verification success';
            this.articoliVerification.innerHTML = '✅ Art. 74 + Art. 22 = Scontrinato Totale ✓';
        } else {
            this.articoliVerification.className = 'articoli-verification error';
            this.articoliVerification.innerHTML = 
                `❌ AVVISO: Art. 74 + Art. 22 ≠ Scontrinato Totale! Differenza: €${differenza.toFixed(2)}`;
        }
    }
    updateDropPosStatus() {
        if (!this.plafondFill) return;
        const dropAmount = parseFloat(this.dropPos?.value) || 0;
        const percentage = (dropAmount / 1500) * 100;
        this.plafondFill.style.width = `${Math.min(percentage, 100)}%`;
        if (percentage < 80) {
            this.plafondFill.style.background = '#28a745';
        } else if (percentage < 100) {
            this.plafondFill.style.background = '#ffc107';
        } else {
            this.plafondFill.style.background = '#dc3545';
        }
    }
    updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateEl = document.getElementById('currentDate');
        const timeEl = document.getElementById('currentTime');
        if (dateEl) dateEl.textContent = now.toLocaleDateString('it-IT', options);
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('it-IT');
    }
    updateCountdown() {
        if (!this.countdown) return;
        const now = new Date();
        const deadline = new Date();
        deadline.setHours(20, 0, 0, 0);
        if (now > deadline) {
            deadline.setDate(deadline.getDate() + 1);
        }
        const diff = deadline - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        this.countdown.textContent = `${hours}h ${minutes}m alle 20:00`;
        if (hours < 2) {
            this.countdown.style.color = '#dc3545';
            this.countdown.style.fontWeight = 'bold';
        }
    }
    salvaChiusura(e) {
        e.preventDefault();
        const moneteAttuali = parseFloat(this.moneteAttuali?.value) || 0;
        const moneteGiornoPrecedente = parseFloat(this.moneteGiornoPrecedente?.value) || 0;
        const differenzaMonete = moneteAttuali - moneteGiornoPrecedente;
        const data = {
            data: this.currentEditDate.toISOString(),
            scontrinatoTotale: parseFloat(this.scontrinatoTotale?.value) || 0,
            scontrinatoContanti: parseFloat(this.scontrinatoContanti?.value) || 0,
            scontrinatoPos: parseFloat(this.scontrinatoPos?.value) || 0,
            art74: parseFloat(this.art74?.value) || 0,
            art22: parseFloat(this.art22?.value) || 0,
            dropPos: parseFloat(this.dropPos?.value) || 0,
            dropCash: parseFloat(this.dropCash?.value) || 0,
            moneteGiornoPrecedente: moneteGiornoPrecedente,
            moneteAttuali: moneteAttuali,
            totaleContantiCassa: parseFloat(this.totaleContantiCassa?.value) || 0,
            fondoCassa: parseFloat(this.fondoCassaResult?.textContent.replace('€', '')) || 0,
            differenzaMonete: differenzaMonete,
            status: this.getOverallStatus()
        };
        const dateKey = this.getDateKey(this.currentEditDate);
        localStorage.setItem(`chiusura_${dateKey}`, JSON.stringify(data));
        this.showModal('success', 'Chiusura Salvata', 
            `La chiusura cassa per il ${this.currentEditDate.toLocaleDateString('it-IT')} è stata salvata correttamente!`);
        if (window.calendarChiusure) window.calendarChiusure.render();
        if (window.cassaCalendar) window.cassaCalendar.render();
        const isToday = this.getDateKey(this.currentEditDate) === this.getDateKey(new Date());
        if (isToday) {
            if (this.scontrinatoTotale) this.scontrinatoTotale.value = '';
            if (this.scontrinatoContanti) this.scontrinatoContanti.value = '';
            if (this.scontrinatoPos) this.scontrinatoPos.value = '';
            if (this.art74) this.art74.value = '';
            if (this.art22) this.art22.value = '';
            if (this.dropPos) this.dropPos.value = '';
            if (this.dropCash) this.dropCash.value = '';
            if (this.totaleContantiCassa) this.totaleContantiCassa.value = '';
            if (this.moneteAttuali) this.moneteAttuali.value = '';
        }
    }
    esportaReport() {
        const dateKey = this.getDateKey(this.currentEditDate);
        const data = localStorage.getItem(`chiusura_${dateKey}`);
        if (!data) {
            this.showModal('warning', 'Nessun Dato', 
                `Non ci sono dati da esportare per il ${this.currentEditDate.toLocaleDateString('it-IT')}.`);
            return;
        }
        const chiusura = JSON.parse(data);
        const report = this.generateReport(chiusura);
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chiusura_cassa_${dateKey}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
    generateReport(data) {
        const date = new Date(data.data).toLocaleDateString('it-IT');
        return `
REPORT CHIUSURA CASSA
=====================
Data: ${date}
Ora: ${new Date(data.data).toLocaleTimeString('it-IT')}

SCONTRINATO GIORNALIERO
-----------------------
Totale: €${data.scontrinatoTotale.toFixed(2)}
Contanti: €${data.scontrinatoContanti.toFixed(2)}
POS: €${data.scontrinatoPos.toFixed(2)}

ARTICOLI FISCALI
----------------
Art. 74: €${(data.art74 || 0).toFixed(2)}
Art. 22: €${(data.art22 || 0).toFixed(2)}
Totale Articoli: €${((data.art74 || 0) + (data.art22 || 0)).toFixed(2)}

DROP
----
Drop POS: €${data.dropPos.toFixed(2)}
Drop Cash: €${data.dropCash.toFixed(2)}

MONETE (Base: €70.00)
---------------------
Giorno Precedente: €${data.moneteGiornoPrecedente.toFixed(2)}
Attuali: €${data.moneteAttuali.toFixed(2)}
Differenza: €${(data.differenzaMonete || 0).toFixed(2)}

FONDO CASSA
-----------
Totale Contanti in Cassa: €${data.totaleContantiCassa.toFixed(2)}
Risultato Fondo Cassa: €${data.fondoCassa.toFixed(2)}
(Fondo cassa iniziale di €100.00 già sottratto)

STATUS: ${(data.status || 'N/A').toUpperCase()}

Generato il: ${new Date().toLocaleString('it-IT')}
        `.trim();
    }
    showModal(type, title, message) {
        if (!this.modal || !this.modalBody) return;
        const icon = type === 'success' ? '✅' : 
                    type === 'warning' ? '⚠️' : 
                    type === 'info' ? 'ℹ️' : '❌';
        this.modalBody.innerHTML = `
            <h2>${icon} ${title}</h2>
            <p>${message}</p>
        `;
        this.modal.style.display = 'block';
    }
    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
    }
    updateStatus(type, message) {
        const dot = this.statusIndicator?.querySelector('.status-dot');
        const text = this.statusIndicator?.querySelector('.status-text');
        if (dot && text) {
            dot.className = `status-dot ${type}`;
            text.textContent = message;
        }
    }
    getOverallStatus() {
        const hasCalculationErrors = (this.verificationResult?.classList.contains('error') || false) ||
                                   (this.articoliVerification?.classList.contains('error') || false);
        const fondoCassa = parseFloat(this.fondoCassaResult?.textContent.replace('€', '')) || 0;
        if (hasCalculationErrors) return 'warning';
        if (Math.abs(fondoCassa) > 50) return 'warning';
        return 'ok';
    }
    getDateKey(date) {
        return date.toISOString().split('T')[0];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setInterval(updateModernDateTime, 1000);
    updateModernDateTime();
    aggiornaDataOra();
    setInterval(aggiornaDataOra, 1000);
    if (document.getElementById('dashboardPeriod')) {
        document.getElementById('dashboardPeriod').onchange = aggiornaDashboardAvanzata;
        aggiornaDashboardAvanzata();
    }
    if (document.getElementById('dashboardYear')) {
        document.getElementById('dashboardYear').onchange = aggiornaDashboardAvanzata;
    }
    if (document.getElementById('refreshDashboard')) {
        document.getElementById('refreshDashboard').onclick = aggiornaDashboardAvanzata;
    }
    caricaFornitori();
    mostraFatture();
    mostraRicorrenze();
    const aggiungiFornitoreBtn = document.getElementById('aggiungiFornitore');
    const nuovoFornitoreInput = document.getElementById('nuovoFornitore');
    if (aggiungiFornitoreBtn) aggiungiFornitoreBtn.onclick = aggiungiFornitore;
    if (nuovoFornitoreInput) {
        nuovoFornitoreInput.onkeypress = (e) => {
            if (e.key === 'Enter') aggiungiFornitore();
        };
    }
    const fatturaForm = document.getElementById('fatturaForm');
    const resetFatturaBtn = document.getElementById('resetFatturaForm');
    if (fatturaForm) fatturaForm.onsubmit = salvaFattura;
    if (resetFatturaBtn) resetFatturaBtn.onclick = resetFatturaForm;
    const filtroStato = document.getElementById('filtroStato');
    const filtroFornitore = document.getElementById('filtroFornitore');
    const filtroRicerca = document.getElementById('filtroRicerca');
    if (filtroStato) filtroStato.onchange = mostraFatture;
    if (filtroFornitore) filtroFornitore.onchange = mostraFatture;
    if (filtroRicerca) filtroRicerca.oninput = mostraFatture;
    const ricorrenzaForm = document.getElementById('ricorrenzaForm');
    const resetRicorrenzaBtn = document.getElementById('resetRicorrenzaForm');
    if (ricorrenzaForm) ricorrenzaForm.onsubmit = salvaRicorrenza;
    if (resetRicorrenzaBtn) resetRicorrenzaBtn.onclick = () => ricorrenzaForm.reset();
    new CalendarChiusure();
    window.cassaCalendar = new CassaCalendar();
    window.chiusuraCassaSystem = new ChiusuraCassaSystem();
    console.log('🎉 Sistema aziendale con header moderno inizializzato con successo!');
});
