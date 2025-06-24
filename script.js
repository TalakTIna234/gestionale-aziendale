// Database functions per Supabase - AGGIUNTA SENZA MODIFICARE IL RESTO
// Configurazione Supabase
const SUPABASE_URL = 'https://fodowfardgribthpgxxs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvZG93ZmFyZGdyaWJ0aHBneHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1OTkyNzIsImV4cCI6MjA2NjE3NTI3Mn0.KXvV_Lzve4sUNzM79Zp31kuzos4jGTIRqGV0UGewLfk';
const USE_SUPABASE = true;

// Inizializza Supabase correttamente
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


class DatabaseManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    async saveData(table, data, key = null) {
        if (USE_SUPABASE && this.isOnline) {
            try {
                let result;
                if (key) {
                    result = await supabaseClient.from(table).update(data).eq('id', key).select();
                } else {
                    result = await supabaseClient.from(table).insert([data]).select();
                }
                
                if (result.error) {
                    console.error('Errore Supabase:', result.error);
                    throw result.error;
                }
                return result.data[0];
            } catch (error) {
                console.error('Errore Supabase:', error);
                return this.saveToLocalStorage(table, data, key);
            }
        } else {
            return this.saveToLocalStorage(table, data, key);
        }
    }

    async loadData(table, filters = null) {
        if (USE_SUPABASE && this.isOnline) {
            try {
                let query = supabaseClient.from(table).select('*');
                if (filters) {
                    Object.entries(filters).forEach(([key, value]) => {
                        query = query.eq(key, value);
                    });
                }
                const result = await query;
                if (result.error) {
                    console.error('Errore caricamento Supabase:', result.error);
                    throw result.error;
                }
                return result.data || [];
            } catch (error) {
                console.error('Errore caricamento Supabase:', error);
                return this.loadFromLocalStorage(table);
            }
        } else {
            return this.loadFromLocalStorage(table);
        }
    }

    async deleteData(table, id) {
        if (USE_SUPABASE && this.isOnline) {
            try {
                const result = await supabaseClient.from(table).delete().eq('id', id);
                if (result.error) {
                    console.error('Errore eliminazione Supabase:', result.error);
                    throw result.error;
                }
                return true;
            } catch (error) {
                console.error('Errore eliminazione Supabase:', error);
                return this.deleteFromLocalStorage(table, id);
            }
        } else {
            return this.deleteFromLocalStorage(table, id);
        }
    }

    saveToLocalStorage(table, data, key = null) {
        if (key) {
            localStorage.setItem(`${table}_${key}`, JSON.stringify(data));
        } else {
            const existingData = JSON.parse(localStorage.getItem(table) || '[]');
            const newId = Date.now().toString();
            data.id = newId;
            existingData.push(data);
            localStorage.setItem(table, JSON.stringify(existingData));
        }
        return data;
    }

    loadFromLocalStorage(table) {
        return JSON.parse(localStorage.getItem(table) || '[]');
    }

    deleteFromLocalStorage(table, id) {
        const data = this.loadFromLocalStorage(table);
        const filtered = data.filter(item => item.id !== id);
        localStorage.setItem(table, JSON.stringify(filtered));
        return true;
    }

    async syncOfflineData() {
        if (!USE_SUPABASE || !this.isOnline) return;
        console.log('Sincronizzazione dati offline...');
        for (const item of this.syncQueue) {
            try {
                await this.saveData(item.table, item.data, item.key);
            } catch (error) {
                console.error('Errore sincronizzazione:', error);
            }
        }
        this.syncQueue = [];
    }
}


// Inizializza il database manager
const dbManager = new DatabaseManager();

// TUTTO IL TUO CODICE ORIGINALE MODIFICATO PER SUPABASE:
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

async function updateTodayRevenue() {
    const today = new Date().toISOString().split('T')[0];
    const revenueEl = document.getElementById('todayRevenue');
    
    if (revenueEl) {
        try {
            const chiusure = await dbManager.loadData('chiusure_cassa');
            const todayData = chiusure.find(c => c.data === today);
            
            if (todayData) {
                revenueEl.textContent = `€${(todayData.scontrinatoTotale || 0).toFixed(0)}`;
            } else {
                revenueEl.textContent = '€0';
            }
        } catch (error) {
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
        start = new Date(now);
        start.setDate(now.getDate() - day + 1);
        end = new Date(now);
        end.setDate(start.getDate() + 6);
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

async function aggiornaDashboardAvanzata() {
    const period = document.getElementById('dashboardPeriod')?.value || 'month';
    const year = parseInt(document.getElementById('dashboardYear')?.value || new Date().getFullYear());
    const {start, end} = getPeriodoDateRange(period, year);
    const datiFinanziari = await raccogliDatiFinanziari(start, end);
    aggiornaKPI(datiFinanziari);
    aggiornaSezioniDettagliate(datiFinanziari);
    aggiornaGrafici(datiFinanziari, period, year);
    generaAlert(datiFinanziari);
    calcolaPrevisioni(datiFinanziari);
}

async function raccogliDatiFinanziari(start, end) {
    try {
        // Carica da Supabase invece di localStorage
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusureFiltrate = chiusure.filter(c => {
            const d = new Date(c.data);
            return d >= start && d <= end;
        });

        const fatture = await dbManager.loadData('fatture');
        const fattureFiltrate = fatture.filter(f => {
            const d = new Date(f.data);
            return d >= start && d <= end;
        });

        const ricorrenze = await dbManager.loadData('ricorrenze');

        const ricaviCassa = chiusureFiltrate.reduce((sum, c) => sum + (c.scontrinatoTotale || 0), 0);
        const entrateRicorrenti = calcolaRicorrenze(ricorrenze, 'entrata', start, end);
        const usciteRicorrenti = calcolaRicorrenze(ricorrenze, 'uscita', start, end);
        const fatturepagate = fattureFiltrate.filter(f => f.stato === 'pagata').reduce((sum, f) => sum + f.importo, 0);
        const fatturePendenti = fattureFiltrate.filter(f => f.stato === 'da pagare').reduce((sum, f) => sum + f.importo, 0);
        const fattureScadute = fattureFiltrate.filter(f => {
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
            chiusure: chiusureFiltrate, fatture: fattureFiltrate, ricorrenze, ricaviCassa, entrateRicorrenti, usciteRicorrenti,
            fatturepagate, fatturePendenti, fattureScadute, totaleEntrate, totaleUscite,
            utileNetto, ivaVendite, ivaAcquisti, ivaNettaDaVersare, start, end
        };
    } catch (error) {
        console.error('Errore raccolta dati finanziari:', error);
        return {
            chiusure: [], fatture: [], ricorrenze: [], ricaviCassa: 0, entrateRicorrenti: 0, usciteRicorrenti: 0,
            fatturepagate: 0, fatturePendenti: 0, fattureScadute: 0, totaleEntrate: 0, totaleUscite: 0,
            utileNetto: 0, ivaVendite: 0, ivaAcquisti: 0, ivaNettaDaVersare: 0, start, end
        };
    }
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
    
    Promise.all(Array.from({length: 12}, async (_, mese) => {
        const inizioMese = new Date(year, mese, 1);
        const fineMese = new Date(year, mese + 1, 0);
        const datiMese = await raccogliDatiFinanziari(inizioMese, fineMese);
        entratePerMese[mese] = datiMese.totaleEntrate;
        uscitePerMese[mese] = datiMese.totaleUscite;
    })).then(() => {
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
    
    Promise.all(Array.from({length: 6}, async (_, i) => {
        const data = new Date();
        data.setMonth(data.getMonth() - (5 - i));
        mesi[i] = data.toLocaleDateString('it-IT', { month: 'short' });
        const inizioMese = new Date(data.getFullYear(), data.getMonth(), 1);
        const fineMese = new Date(data.getFullYear(), data.getMonth() + 1, 0);
        const datiMese = await raccogliDatiFinanziari(inizioMese, fineMese);
        ivaData[i] = datiMese.ivaNettaDaVersare;
    })).then(() => {
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

// Funzioni per fornitori modificate per Supabase
async function caricaFornitori() {
    try {
        const fornitori = await dbManager.loadData('fornitori');
        const fornitoreSelect = document.getElementById('fornitore');
        const filtroFornitore = document.getElementById('filtroFornitore');
        const fornitoriList = document.getElementById('fornitoriList');
        
        if (fornitoreSelect) {
            fornitoreSelect.innerHTML = '<option value="">Seleziona fornitore...</option>';
            fornitori.forEach(f => {
                const option = document.createElement('option');
                option.value = f.nome;
                option.textContent = f.nome;
                fornitoreSelect.appendChild(option);
            });
        }
        if (filtroFornitore) {
            filtroFornitore.innerHTML = '<option value="">Tutti i fornitori</option>';
            fornitori.forEach(f => {
                const option = document.createElement('option');
                option.value = f.nome;
                option.textContent = f.nome;
                filtroFornitore.appendChild(option);
            });
        }
        if (fornitoriList) {
            fornitoriList.innerHTML = fornitori.map(f => `
                <div class="fornitore-tag">
                    ${f.nome}
                    <button class="remove-btn" onclick="rimuoviFornitore('${f.id}')">&times;</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Errore caricamento fornitori:', error);
    }
}

async function aggiungiFornitore() {
    const input = document.getElementById('nuovoFornitore');
    const nome = input.value.trim();
    if (!nome) return;
    
    try {
        const fornitori = await dbManager.loadData('fornitori');
        const exists = fornitori.some(f => f.nome === nome);
        
        if (exists) {
            showNotification('warning', 'Fornitore già esistente!');
            return;
        }
        
        await dbManager.saveData('fornitori', { nome: nome });
        await caricaFornitori();
        input.value = '';
        showNotification('success', `Fornitore "${nome}" aggiunto con successo!`);
    } catch (error) {
        console.error('Errore aggiunta fornitore:', error);
        showNotification('error', 'Errore nell\'aggiunta del fornitore');
    }
}

async function rimuoviFornitore(id) {
    if (!confirm('Rimuovere questo fornitore?')) return;
    
    try {
        await dbManager.deleteData('fornitori', id);
        await caricaFornitori();
        await mostraFatture();
        showNotification('info', 'Fornitore rimosso.');
    } catch (error) {
        console.error('Errore rimozione fornitore:', error);
    }
}

// Funzioni per fatture modificate per Supabase
let fatturaInModifica = null;

async function salvaFattura(e) {
    e.preventDefault();
    const id = document.getElementById('fatturaId')?.value || null;
    const nuovaFattura = {
        fornitore: document.getElementById('fornitore').value,
        importo: parseFloat(document.getElementById('importo').value),
        descrizione: document.getElementById('descrizione').value,
        data: document.getElementById('dataFattura').value,
        scadenza: document.getElementById('scadenza').value,
        modalitaPagamento: document.getElementById('modalitaPagamento').value,
        stato: document.getElementById('stato').value
    };
    
    try {
        if (id) {
            await dbManager.saveData('fatture', nuovaFattura, id);
            showNotification('success', 'Fattura aggiornata con successo!');
        } else {
            await dbManager.saveData('fatture', nuovaFattura);
            showNotification('success', 'Fattura salvata con successo!');
        }
        
        await mostraFatture();
        resetFatturaForm();
        if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
            aggiornaDashboardAvanzata();
        }
    } catch (error) {
        console.error('Errore salvataggio fattura:', error);
        showNotification('error', 'Errore nel salvataggio della fattura');
    }
}

async function modificaFattura(id) {
    try {
        const fatture = await dbManager.loadData('fatture');
        const fattura = fatture.find(f => f.id == id);
        if (!fattura) return;
        
        fatturaInModifica = fattura;
        if (document.getElementById('fatturaId')) document.getElementById('fatturaId').value = fattura.id;
        document.getElementById('fornitore').value = fattura.fornitore;
        document.getElementById('importo').value = fattura.importo;
        document.getElementById('descrizione').value = fattura.descrizione;
        document.getElementById('dataFattura').value = fattura.data;
        document.getElementById('scadenza').value = fattura.scadenza;
        document.getElementById('modalitaPagamento').value = fattura.modalitaPagamento;
        document.getElementById('stato').value = fattura.stato;
        document.getElementById('fatturaForm').scrollIntoView({ behavior: 'smooth' });
        showNotification('info', 'Fattura caricata per la modifica');
    } catch (error) {
        console.error('Errore modifica fattura:', error);
    }
}

async function eliminaFattura(id) {
    try {
        const fatture = await dbManager.loadData('fatture');
        const fattura = fatture.find(f => f.id == id);
        if (!fattura) return;
        
        if (confirm(`Eliminare la fattura di ${fattura.fornitore} per €${fattura.importo.toFixed(2)}?`)) {
            await dbManager.deleteData('fatture', id);
            await mostraFatture();
            showNotification('info', 'Fattura eliminata');
            if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
                aggiornaDashboardAvanzata();
            }
        }
    } catch (error) {
        console.error('Errore eliminazione fattura:', error);
    }
}

function resetFatturaForm() {
    document.getElementById('fatturaForm').reset();
    if (document.getElementById('fatturaId')) document.getElementById('fatturaId').value = '';
    fatturaInModifica = null;
}

async function mostraFatture() {
    try {
        const fatture = await dbManager.loadData('fatture');
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
                            <div class="fattura-detail-value">${f.modalitaPagamento}</div>
                        </div>
                    </div>
                    <div class="fattura-actions">
                        <button class="btn-edit" onclick="modificaFattura('${f.id}')">✏️ Modifica</button>
                        <button class="btn-delete" onclick="eliminaFattura('${f.id}')">🗑️ Elimina</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Errore visualizzazione fatture:', error);
    }
}

// Funzioni per ricorrenze modificate per Supabase
async function salvaRicorrenza(e) {
    e.preventDefault();
    const id = document.getElementById('ricorrenzaId')?.value || null;
    const nuovaRic = {
        tipo: document.getElementById('tipoRicorrenza').value,
        nome: document.getElementById('nomeRicorrenza').value,
        importo: parseFloat(document.getElementById('importoRicorrenza').value),
        frequenza: document.getElementById('frequenzaRicorrenza').value
    };
    
    try {
        if (id) {
            await dbManager.saveData('ricorrenze', nuovaRic, id);
        } else {
            await dbManager.saveData('ricorrenze', nuovaRic);
        }
        
        await mostraRicorrenze();
        e.target.reset();
        if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
            aggiornaDashboardAvanzata();
        }
        showNotification('success', 'Ricorrenza salvata con successo!');
    } catch (error) {
        console.error('Errore salvataggio ricorrenza:', error);
        showNotification('error', 'Errore nel salvataggio della ricorrenza');
    }
}

async function mostraRicorrenze() {
    try {
        const ricorrenze = await dbManager.loadData('ricorrenze');
        const list = document.getElementById('ricorrenzeList');
        if (list) {
            list.innerHTML = ricorrenze.length
                ? ricorrenze.map(r => `<div class="ricorrenza-item">
                    <b>${r.tipo == 'entrata' ? 'Entrata' : 'Uscita'}</b>: ${r.nome} - €${r.importo.toFixed(2)} (${r.frequenza})
                    <button class="btn-delete" onclick="eliminaRicorrenza('${r.id}')" style="float: right; margin-left: 10px;">🗑️</button>
                </div>`).join('')
                : '<em>Nessuna ricorrenza registrata</em>';
        }
    } catch (error) {
        console.error('Errore visualizzazione ricorrenze:', error);
    }
}

async function eliminaRicorrenza(id) {
    if (!confirm('Sei sicuro di voler eliminare questa ricorrenza?')) return;
    
    try {
        await dbManager.deleteData('ricorrenze', id);
        await mostraRicorrenze();
        showNotification('success', 'Ricorrenza eliminata con successo!');
        if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
            aggiornaDashboardAvanzata();
        }
    } catch (error) {
        console.error('Errore eliminazione ricorrenza:', error);
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
        background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : type === 'error' ? '#dc3545' : '#17a2b8'};
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
        this.detailsContent = document.getElementById('detailsContent');
        if (!this.grid || !this.monthLabel) return;
        this.render();
    }
    async render() {
        if (!this.grid || !this.monthLabel) return;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.monthLabel.textContent = this.currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        this.grid.innerHTML = '';
        days.forEach(d => {
            const el = document.createElement('div');
            el.className = 'calendar-header';
            el.textContent = d;
            this.grid.appendChild(el);
        });
        const first = new Date(year, month, 1);
        const startDay = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Carica dati chiusure da Supabase
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusureMap = {};
        chiusure.forEach(c => {
            chiusureMap[c.data.split('T')[0]] = c;
        });
        
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
            if (chiusureMap[dateKey]) el.classList.add('has-data');
            el.textContent = d;
            el.onclick = () => this.showDetails(date);
            this.grid.appendChild(el);
        }
    }
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }
    isToday(date) {
        const now = new Date();
        return date.getDate() === now.getDate() &&
               date.getMonth() === now.getMonth() &&
               date.getFullYear() === now.getFullYear();
    }
    async showDetails(date) {
        const dateKey = date.toISOString().split('T')[0];
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusura = chiusure.find(c => c.data.split('T')[0] === dateKey);
        
        if (!chiusura) {
            if (this.details) this.details.style.display = 'none';
            return;
        }
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
    printDetails() {
        const content = this.detailsContent?.textContent;
        if (content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head><title>Dettagli Chiusura</title></head>
                    <body>
                        <h1>Dettagli Chiusura Cassa</h1>
                        <pre>${content}</pre>
                    </body>
                </html>
            `);
            printWindow.print();
        }
    }
    exportDetails() {
        const content = this.detailsContent?.textContent;
        if (content) {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chiusura_${this.selectedDate.toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
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
        this.selectedDateDisplay = document.getElementById('selectedDateInfo');
        if (!this.grid || !this.monthLabel) return;
        this.render();
        this.updateSelectedDateDisplay();
    }
    async render() {
        if (!this.grid || !this.monthLabel) return;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.monthLabel.textContent = this.currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        this.grid.innerHTML = '';
        days.forEach(d => {
            const el = document.createElement('div');
            el.className = 'cassa-calendar-header';
            el.textContent = d;
            this.grid.appendChild(el);
        });
        const first = new Date(year, month, 1);
        const startDay = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Carica dati chiusure da Supabase
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusureMap = {};
        chiusure.forEach(c => {
            chiusureMap[c.data.split('T')[0]] = c;
        });
        
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
            if (chiusureMap[dateKey]) el.classList.add('has-data');
            el.textContent = d;
            el.onclick = () => this.selectDate(date);
            this.grid.appendChild(el);
        }
    }
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
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
    async selectDate(date) {
        this.selectedDate = new Date(date);
        this.render();
        this.updateSelectedDateDisplay();
        if (window.chiusuraCassaSystem) {
            window.chiusuraCassaSystem.changeEditDate(date);
        }
    }
    async updateSelectedDateDisplay() {
        if (!this.selectedDateDisplay || !this.selectedDate) return;
        const dateStr = this.selectedDate.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const isToday = this.isToday(this.selectedDate);
        
        const dateKey = this.selectedDate.toISOString().split('T')[0];
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusura = chiusure.find(c => c.data.split('T')[0] === dateKey);
        
        if (chiusura) {
            this.selectedDateDisplay.innerHTML = `
                <strong>${dateStr} ${isToday ? '(OGGI)' : ''}</strong><br>
                Scontrinato: €${(chiusura.scontrinatoTotale || 0).toFixed(2)}<br>
                Fondo Cassa: €${(chiusura.fondoCassa || 0).toFixed(2)}
            `;
        } else {
            this.selectedDateDisplay.innerHTML = `
                <strong>${dateStr} ${isToday ? '(OGGI)' : ''}</strong><br>
                Nessuna chiusura registrata
            `;
        }
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
        this.modal = document.getElementById('messageModal');
        this.modalBody = document.getElementById('modalBody');
    }
    async loadStoredData() {
        const yesterday = new Date(this.currentEditDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = this.getDateKey(yesterday);
        
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const yesterdayData = chiusure.find(c => c.data.split('T')[0] === yesterdayKey);
        
        if (this.moneteGiornoPrecedente) {
            if (yesterdayData) {
                this.moneteGiornoPrecedente.value = yesterdayData.moneteAttuali || 70;
            } else {
                this.moneteGiornoPrecedente.value = 70;
            }
        }
        const currentKey = this.getDateKey(this.currentEditDate);
        const currentData = chiusure.find(c => c.data.split('T')[0] === currentKey);
        
        if (currentData) {
            if (this.scontrinatoTotale) this.scontrinatoTotale.value = currentData.scontrinatoTotale || '';
            if (this.scontrinatoContanti) this.scontrinatoContanti.value = currentData.scontrinatoContanti || '';
            if (this.scontrinatoPos) this.scontrinatoPos.value = currentData.scontrinatoPos || '';
            if (this.art74) this.art74.value = currentData.art74 || '';
            if (this.art22) this.art22.value = currentData.art22 || '';
            if (this.dropPos) this.dropPos.value = currentData.dropPos || '';
            if (this.dropCash) this.dropCash.value = currentData.dropCash || '';
            if (this.moneteAttuali) this.moneteAttuali.value = currentData.moneteAttuali || '';
            if (this.totaleContantiCassa) this.totaleContantiCassa.value = currentData.totaleContantiCassa || '';
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

    async salvaChiusura(e) {
        if (e) e.preventDefault();
        
        const moneteAttuali = parseFloat(this.moneteAttuali?.value) || 0;
        const moneteGiornoPrecedente = parseFloat(this.moneteGiornoPrecedente?.value) || 0;
        const differenzaMonete = moneteAttuali - moneteGiornoPrecedente;
        const totaleContanti = parseFloat(this.totaleContantiCassa?.value) || 0;
        const scontrinatoCash = parseFloat(this.scontrinatoContanti?.value) || 0;
        const dropCash = parseFloat(this.dropCash?.value) || 0;
        const fondoCassa = totaleContanti - scontrinatoCash - dropCash + differenzaMonete - 100;
        
        const data = {
            data: this.currentEditDate.toISOString().split('T')[0],
            scontrinatoTotale: parseFloat(this.scontrinatoTotale?.value) || 0,
            scontrinatoContanti: parseFloat(this.scontrinatoContanti?.value) || 0,
            scontrinatoPos: parseFloat(this.scontrinatoPos?.value) || 0,
            art74: parseFloat(this.art74?.value) || 0,
            art22: parseFloat(this.art22?.value) || 0,
            dropPos: parseFloat(this.dropPos?.value) || 0,
            dropCash: parseFloat(this.dropCash?.value) || 0,
            moneteGiornoPrecedente: moneteGiornoPrecedente,
            moneteAttuali: moneteAttuali,
            totaleContantiCassa: totaleContanti,
            fondoCassa: fondoCassa,
            differenzaMonete: differenzaMonete,
            status: this.getOverallStatus(),
            timestamp: new Date().toISOString()
        };
        
        try {
            await dbManager.saveData('chiusure_cassa', data);
            showNotification('success', `Chiusura cassa salvata per il ${this.currentEditDate.toLocaleDateString('it-IT')}!`);
            
            // Aggiorna i calendari
            if (window.calendarChiusure) window.calendarChiusure.render();
            if (window.cassaCalendar) window.cassaCalendar.render();
            
            // Aggiorna dashboard se attivo
            if (document.querySelector('.nav-btn.active')?.dataset.section === 'dashboard') {
                aggiornaDashboardAvanzata();
            }
            
        } catch (error) {
            console.error('Errore salvataggio chiusura:', error);
            showNotification('error', 'Errore nel salvataggio della chiusura');
        }
    }

    esportaReport() {
        const dateKey = this.getDateKey(this.currentEditDate);
        const values = this.getFormValues();
        
        const report = `
REPORT CHIUSURA CASSA
=====================
Data: ${this.currentEditDate.toLocaleDateString('it-IT')}
Ora: ${new Date().toLocaleTimeString('it-IT')}

SCONTRINATO GIORNALIERO
-----------------------
Totale: €${values.scontrinatoTotale.toFixed(2)}
Contanti: €${values.scontrinatoContanti.toFixed(2)}
POS: €${values.scontrinatoPos.toFixed(2)}

ARTICOLI FISCALI
----------------
Art. 74: €${values.art74.toFixed(2)}
Art. 22: €${values.art22.toFixed(2)}
Totale Articoli: €${(values.art74 + values.art22).toFixed(2)}

DROP
----
Drop POS: €${values.dropPos.toFixed(2)}
Drop Cash: €${values.dropCash.toFixed(2)}

MONETE (Base: €70.00)
---------------------
Giorno Precedente: €${values.moneteGiornoPrecedente.toFixed(2)}
Attuali: €${values.moneteAttuali.toFixed(2)}
Differenza: €${(values.moneteAttuali - values.moneteGiornoPrecedente).toFixed(2)}

FONDO CASSA
-----------
Totale Contanti in Cassa: €${values.totaleContantiCassa.toFixed(2)}
Risultato Fondo Cassa: €${(values.totaleContantiCassa - values.scontrinatoContanti - values.dropCash + (values.moneteAttuali - values.moneteGiornoPrecedente) - 100).toFixed(2)}

Generato il: ${new Date().toLocaleString('it-IT')}
        `.trim();
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chiusura_cassa_${dateKey}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('success', 'Report esportato con successo!');
    }

    getFormValues() {
        return {
            scontrinatoTotale: parseFloat(this.scontrinatoTotale?.value) || 0,
            scontrinatoContanti: parseFloat(this.scontrinatoContanti?.value) || 0,
            scontrinatoPos: parseFloat(this.scontrinatoPos?.value) || 0,
            art74: parseFloat(this.art74?.value) || 0,
            art22: parseFloat(this.art22?.value) || 0,
            dropPos: parseFloat(this.dropPos?.value) || 0,
            dropCash: parseFloat(this.dropCash?.value) || 0,
            moneteGiornoPrecedente: parseFloat(this.moneteGiornoPrecedente?.value) || 0,
            moneteAttuali: parseFloat(this.moneteAttuali?.value) || 0,
            totaleContantiCassa: parseFloat(this.totaleContantiCassa?.value) || 0
        };
    }

    showModal(type, title, message) {
        const modal = document.getElementById('messageModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) return;
        
        const icon = type === 'success' ? '✅' : 
                    type === 'warning' ? '⚠️' : 
                    type === 'info' ? 'ℹ️' : '❌';
        
        modalBody.innerHTML = `
            <h2>${icon} ${title}</h2>
            <p>${message}</p>
        `;
        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('messageModal');
        if (modal) modal.style.display = 'none';
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

// Inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Avvia aggiornamento orario
    setInterval(updateModernDateTime, 1000);
    updateModernDateTime();

    // Inizializza dashboard se presente
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

    // Carica dati iniziali
    caricaFornitori();
    mostraFatture();
    mostraRicorrenze();

    // Setup event listeners per gestione fornitori
    const aggiungiFornitoreBtn = document.getElementById('aggiungiFornitore');
    const nuovoFornitoreInput = document.getElementById('nuovoFornitore');
    if (aggiungiFornitoreBtn) aggiungiFornitoreBtn.onclick = aggiungiFornitore;
    if (nuovoFornitoreInput) {
        nuovoFornitoreInput.onkeypress = (e) => {
            if (e.key === 'Enter') aggiungiFornitore();
        };
    }

    // Setup event listeners per form fatture
    const fatturaForm = document.getElementById('fatturaForm');
    const resetFatturaBtn = document.getElementById('resetFatturaForm');
    if (fatturaForm) fatturaForm.onsubmit = salvaFattura;
    if (resetFatturaBtn) resetFatturaBtn.onclick = resetFatturaForm;

    // Setup filtri per fatture
    const filtroStato = document.getElementById('filtroStato');
    const filtroFornitore = document.getElementById('filtroFornitore');
    const filtroRicerca = document.getElementById('filtroRicerca');
    if (filtroStato) filtroStato.onchange = mostraFatture;
    if (filtroFornitore) filtroFornitore.onchange = mostraFatture;
    if (filtroRicerca) filtroRicerca.oninput = mostraFatture;

    // Setup event listeners per form ricorrenze
    const ricorrenzaForm = document.getElementById('ricorrenzaForm');
    const resetRicorrenzaBtn = document.getElementById('resetRicorrenzaForm');
    if (ricorrenzaForm) ricorrenzaForm.onsubmit = salvaRicorrenza;
    if (resetRicorrenzaBtn) resetRicorrenzaBtn.onclick = () => ricorrenzaForm.reset();

    // Inizializza calendari e sistemi
    window.calendarChiusure = new CalendarChiusure();
    window.cassaCalendar = new CassaCalendar();
    window.chiusuraCassaSystem = new ChiusuraCassaSystem();

    console.log('🎉 Sistema aziendale con Supabase inizializzato con successo!');
});
