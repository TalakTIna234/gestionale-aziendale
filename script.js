// Configurazione Supabase
const SUPABASE_URL = 'https://fodowfardgribthpgxxs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvZG93ZmFyZGdyaWJ0aHBneHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1OTkyNzIsImV4cCI6MjA2NjE3NTI3Mn0.KXvV_Lzve4sUNzM79Zp31kuzos4jGTIRqGV0UGewLfk';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sistema notifiche
function showNotification(type, message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, duration);
}

// Funzioni Supabase
async function saveToSupabase(table, data) {
    try {
        const { data: result, error } = await supabase
            .from(table)
            .upsert(data)
            .select();
        
        if (error) throw error;
        return result;
    } catch (error) {
        console.error(`Errore salvando in ${table}:`, error);
        showNotification('error', `Errore nel salvataggio: ${error.message}`);
        throw error;
    }
}

async function loadFromSupabase(table, filters = {}) {
    try {
        let query = supabase.from(table).select('*');
        
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(`Errore caricando da ${table}:`, error);
        showNotification('error', `Errore nel caricamento: ${error.message}`);
        return [];
    }
}

async function deleteFromSupabase(table, id) {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        showNotification('success', 'Elemento eliminato con successo');
    } catch (error) {
        console.error(`Errore eliminando da ${table}:`, error);
        showNotification('error', `Errore nell'eliminazione: ${error.message}`);
        throw error;
    }
}

// Test connessione
async function testSupabaseConnection() {
    try {
        console.log('Testing Supabase connection...');
        const { data, error } = await supabase.from('chiusure_cassa').select('*').limit(1);
        
        if (error) {
            console.error('Supabase Error:', error);
            showNotification('error', `Errore Supabase: ${error.message}`);
        } else {
            console.log('Supabase Data:', data);
            showNotification('success', `Connessione OK. Righe trovate: ${data.length}`);
        }
    } catch (err) {
        console.error('Connection Error:', err);
        showNotification('error', `Errore connessione: ${err.message}`);
    }
}

// Navigazione
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

// Data e ora
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

// ✅ CORRETTO: Usa Supabase invece di localStorage
async function updateTodayRevenue() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const chiusure = await loadFromSupabase('chiusure_cassa', { data: today });
        const revenueEl = document.getElementById('todayRevenue');
        
        if (revenueEl) {
            if (chiusure.length > 0) {
                revenueEl.textContent = `€${(chiusure[0].scontrinato_totale || 0).toFixed(0)}`;
            } else {
                revenueEl.textContent = '€0';
            }
        }
    } catch (error) {
        console.error('Errore aggiornamento ricavi oggi:', error);
    }
}

// Backup da Supabase
async function backupData() {
    try {
        showNotification('info', 'Creazione backup in corso...');
        
        const [chiusure, fatture, fornitori, ricorrenze] = await Promise.all([
            loadFromSupabase('chiusure_cassa'),
            loadFromSupabase('fatture'),
            loadFromSupabase('fornitori'),
            loadFromSupabase('ricorrenze')
        ]);
        
        const backupData = {
            timestamp: new Date().toISOString(),
            chiusure_cassa: chiusure,
            fatture: fatture,
            fornitori: fornitori,
            ricorrenze: ricorrenze
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_gestionale_supabase_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('success', 'Backup completato con successo!');
    } catch (error) {
        showNotification('error', 'Errore durante il backup');
    }
}

function toggleNotifications() {
    showNotification('info', 'Sistema notifiche in arrivo!');
}

function openSettings() {
    showNotification('info', 'Pannello impostazioni in arrivo!');
}

// Dashboard con Supabase
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
    
    const datiFinanziari = await raccogliDatiFinanziariSupabase(start, end);
    
    aggiornaKPI(datiFinanziari);
    aggiornaSezioniDettagliate(datiFinanziari);
    aggiornaGrafici(datiFinanziari, period, year);
    generaAlert(datiFinanziari);
    calcolaPrevisioni(datiFinanziari);
}

// ✅ CORRETTO: Usa Supabase invece di localStorage
async function raccogliDatiFinanziariSupabase(start, end) {
    try {
        // Carica chiusure cassa
        const chiusure = await loadFromSupabase('chiusure_cassa');
        const chiusureFiltrate = chiusure.filter(c => {
            const data = new Date(c.data);
            return data >= start && data <= end;
        });

        // Carica fatture
        const fatture = await loadFromSupabase('fatture');
        const fattureFiltrate = fatture.filter(f => {
            const data = new Date(f.data);
            return data >= start && data <= end;
        });

        // Carica ricorrenze
        const ricorrenze = await loadFromSupabase('ricorrenze');

        const ricaviCassa = chiusureFiltrate.reduce((sum, c) => sum + (c.scontrinato_totale || 0), 0);
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
            chiusure: chiusureFiltrate,
            fatture: fattureFiltrate,
            ricorrenze,
            ricaviCassa,
            entrateRicorrenti,
            usciteRicorrenti,
            fatturepagate,
            fatturePendenti,
            fattureScadute,
            totaleEntrate,
            totaleUscite,
            utileNetto,
            ivaVendite,
            ivaAcquisti,
            ivaNettaDaVersare,
            start,
            end
        };
    } catch (error) {
        console.error('Errore raccolta dati finanziari:', error);
        showNotification('error', 'Errore nel caricamento dei dati finanziari');
        return {
            chiusure: [], fatture: [], ricorrenze: [], ricaviCassa: 0,
            entrateRicorrenti: 0, usciteRicorrenti: 0, fatturepagate: 0,
            fatturePendenti: 0, fattureScadute: 0, totaleEntrate: 0,
            totaleUscite: 0, utileNetto: 0, ivaVendite: 0, ivaAcquisti: 0,
            ivaNettaDaVersare: 0, start, end
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
    
    container.innerHTML = alerts.length > 0 ? 
        alerts.map(alert => `
            <div class="alert ${alert.type}">
                <span style="font-size: 1.2em;">${alert.icon}</span>
                ${alert.message}
            </div>
        `).join('') : 
        '<div class="alert info"><span style="font-size: 1.2em;">ℹ️</span>Tutto sotto controllo! Nessun alert al momento.</div>';
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

async function creaGraficoAndamentoMensile(dati, year) {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const entratePerMese = new Array(12).fill(0);
    const uscitePerMese = new Array(12).fill(0);
    
    for (let mese = 0; mese < 12; mese++) {
        const inizioMese = new Date(year, mese, 1);
        const fineMese = new Date(year, mese + 1, 0);
        const datiMese = await raccogliDatiFinanziariSupabase(inizioMese, fineMese);
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
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toLocaleString();
                        }
                    }
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
            plugins: {
                legend: { position: 'bottom' }
            }
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

async function creaGraficoTrendIVA(dati, year) {
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
        const datiMese = await raccogliDatiFinanziariSupabase(inizioMese, fineMese);
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Gestione Chiusure Cassa
class ChiusuraCassaSystem {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadChiusure();
    }

    initializeElements() {
        this.form = document.getElementById('chiusuraCassaForm');
        this.inputs = {
            scontrinatoTotale: document.getElementById('scontrinatoTotale'),
            scontrinatoContanti: document.getElementById('scontrinatoContanti'),
            scontrinatoPOS: document.getElementById('scontrinatoPOS'),
            articolo74: document.getElementById('articolo74'),
            articolo22: document.getElementById('articolo22'),
            dropPOS: document.getElementById('dropPOS'),
            dropCash: document.getElementById('dropCash'),
            moneteGiornoPrecedente: document.getElementById('moneteGiornoPrecedente'),
            moneteAttuali: document.getElementById('moneteAttuali')
        };
        this.results = {
            contantiInCassa: document.getElementById('contantiInCassa'),
            differenzaMonete: document.getElementById('differenzaMonete'),
            fondoCassa: document.getElementById('fondoCassaResult')
        };
    }

    setupEventListeners() {
        Object.values(this.inputs).forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.calcolaAutomatico());
            }
        });

        const salvaBtn = document.getElementById('salvaChiusura');
        if (salvaBtn) {
            salvaBtn.addEventListener('click', () => this.salvaChiusura());
        }

        const verificaBtn = document.getElementById('verificaCompleta');
        if (verificaBtn) {
            verificaBtn.addEventListener('click', () => this.verificaCompleta());
        }
    }

    async loadChiusure() {
        try {
            const chiusure = await loadFromSupabase('chiusure_cassa');
            if (chiusure.length > 0) {
                const ultimaChiusura = chiusure.sort((a, b) => new Date(b.data) - new Date(a.data))[0];
                this.caricaChiusura(ultimaChiusura);
            }
        } catch (error) {
            console.error('Errore caricamento chiusure:', error);
        }
    }

    caricaChiusura(chiusura) {
        // Mappa i nomi delle colonne del database ai nomi degli input
        const mapping = {
            scontrinato_totale: 'scontrinatoTotale',
            scontrinato_contanti: 'scontrinatoContanti',
            scontrinato_pos: 'scontrinatoPOS',
            articolo_74: 'articolo74',
            articolo_22: 'articolo22',
            drop_pos: 'dropPOS',
            drop_cash: 'dropCash',
            monete_giorno_precedente: 'moneteGiornoPrecedente',
            monete_attuali: 'moneteAttuali'
        };

        Object.entries(mapping).forEach(([dbField, inputKey]) => {
            const input = this.inputs[inputKey];
            if (input && chiusura[dbField] !== undefined) {
                input.value = chiusura[dbField];
            }
        });
        this.calcolaAutomatico();
    }

    calcolaAutomatico() {
        const valori = {};
        Object.entries(this.inputs).forEach(([key, input]) => {
            valori[key] = parseFloat(input?.value || 0);
        });

        const contantiInCassa = valori.scontrinatoContanti + valori.dropCash;
        const differenzaMonete = valori.moneteAttuali - valori.moneteGiornoPrecedente;
        const fondoCassa = contantiInCassa - valori.scontrinatoContanti - valori.dropCash + differenzaMonete - 100;

        if (this.results.contantiInCassa) {
            this.results.contantiInCassa.textContent = `€${contantiInCassa.toFixed(2)}`;
        }
        if (this.results.differenzaMonete) {
            this.results.differenzaMonete.textContent = `€${differenzaMonete.toFixed(2)}`;
        }
        if (this.results.fondoCassa) {
            this.results.fondoCassa.textContent = `€${fondoCassa.toFixed(2)}`;
        }

        this.verificaCompleta();
    }

    verificaCompleta() {
        const scontrinatoTotale = parseFloat(this.inputs.scontrinatoTotale?.value || 0);
        const scontrinatoContanti = parseFloat(this.inputs.scontrinatoContanti?.value || 0);
        const scontrinatoPOS = parseFloat(this.inputs.scontrinatoPOS?.value || 0);
        const articolo74 = parseFloat(this.inputs.articolo74?.value || 0);
        const articolo22 = parseFloat(this.inputs.articolo22?.value || 0);

        const sommaComponenti = scontrinatoContanti + scontrinatoPOS;
        const sommaArticoli = articolo74 + articolo22;

        const verificationResult = document.getElementById('verificationResult');
        const articoliVerification = document.getElementById('articoliVerification');

        if (verificationResult) {
            if (Math.abs(scontrinatoTotale - sommaComponenti) < 0.01) {
                verificationResult.className = 'verification-result success';
                verificationResult.textContent = '✅ Verifica corretta: Scontrinato totale = Contanti + POS';
            } else {
                verificationResult.className = 'verification-result error';
                verificationResult.textContent = `❌ Errore: Differenza di €${(scontrinatoTotale - sommaComponenti).toFixed(2)}`;
            }
        }

        if (articoliVerification) {
            if (Math.abs(scontrinatoTotale - sommaArticoli) < 0.01) {
                articoliVerification.className = 'articoli-verification success';
                articoliVerification.textContent = '✅ Verifica articoli corretta: Scontrinato = Art.74 + Art.22';
            } else {
                articoliVerification.className = 'articoli-verification error';
                articoliVerification.textContent = `❌ Errore articoli: Differenza di €${(scontrinatoTotale - sommaArticoli).toFixed(2)}`;
            }
        }
    }

    async salvaChiusura() {
        try {
            const oggi = new Date().toISOString().split('T')[0];
            const chiusuraData = {
                id: oggi,
                data: oggi,
                scontrinato_totale: parseFloat(this.inputs.scontrinatoTotale?.value || 0),
                scontrinato_contanti: parseFloat(this.inputs.scontrinatoContanti?.value || 0),
                scontrinato_pos: parseFloat(this.inputs.scontrinatoPOS?.value || 0),
                articolo_74: parseFloat(this.inputs.articolo74?.value || 0),
                articolo_22: parseFloat(this.inputs.articolo22?.value || 0),
                drop_pos: parseFloat(this.inputs.dropPOS?.value || 0),
                drop_cash: parseFloat(this.inputs.dropCash?.value || 0),
                monete_giorno_precedente: parseFloat(this.inputs.moneteGiornoPrecedente?.value || 0),
                monete_attuali: parseFloat(this.inputs.moneteAttuali?.value || 0),
                contanti_in_cassa: parseFloat(this.results.contantiInCassa?.textContent.replace('€', '') || 0),
                fondo_cassa: parseFloat(this.results.fondoCassa?.textContent.replace('€', '') || 0),
                created_at: new Date().toISOString()
            };

            await saveToSupabase('chiusure_cassa', chiusuraData);
            showNotification('success', 'Chiusura cassa salvata con successo!');
            
            if (typeof aggiornaDashboardAvanzata === 'function') {
                aggiornaDashboardAvanzata();
            }
        } catch (error) {
            showNotification('error', 'Errore nel salvataggio della chiusura cassa');
        }
    }
}

// Gestione Fatture
async function salvaFattura(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const fatturaData = {
            fornitore: formData.get('fornitore'),
            importo: parseFloat(formData.get('importo')),
            descrizione: formData.get('descrizione'),
            data: formData.get('dataFattura'),
            scadenza: formData.get('scadenza'),
            modalita_pagamento: formData.get('modalitaPagamento'),
            stato: formData.get('stato'),
            created_at: new Date().toISOString()
        };

        await saveToSupabase('fatture', fatturaData);
        showNotification('success', 'Fattura salvata con successo!');
        
        event.target.reset();
        await mostraFatture();
        
        if (typeof aggiornaDashboardAvanzata === 'function') {
            aggiornaDashboardAvanzata();
        }
    } catch (error) {
        showNotification('error', 'Errore nel salvataggio della fattura');
    }
}

async function mostraFatture() {
    try {
        const fatture = await loadFromSupabase('fatture');
        const container = document.getElementById('fattureContainer');
        
        if (!container) return;

        if (fatture.length === 0) {
            container.innerHTML = '<div class="empty-state">Nessuna fattura presente</div>';
            return;
        }

        // Applica filtri
        const filtroStato = document.getElementById('filtroStato')?.value || 'tutti';
        const filtroFornitore = document.getElementById('filtroFornitore')?.value || 'tutti';
        const filtroRicerca = document.getElementById('filtroRicerca')?.value.toLowerCase() || '';

        let fattureFiltrate = fatture.filter(fattura => {
            const matchStato = filtroStato === 'tutti' || fattura.stato === filtroStato;
            const matchFornitore = filtroFornitore === 'tutti' || fattura.fornitore === filtroFornitore;
            const matchRicerca = !filtroRicerca || 
                (fattura.descrizione && fattura.descrizione.toLowerCase().includes(filtroRicerca)) ||
                (fattura.fornitore && fattura.fornitore.toLowerCase().includes(filtroRicerca));
            
            return matchStato && matchFornitore && matchRicerca;
        });

        fattureFiltrate.sort((a, b) => new Date(a.scadenza) - new Date(b.scadenza));

        container.innerHTML = fattureFiltrate.map(fattura => {
            const isScaduta = new Date(fattura.scadenza) < new Date() && fattura.stato === 'da pagare';
            const cardClass = fattura.stato === 'pagata' ? 'pagata' : isScaduta ? 'scaduta' : '';
            
            return `
                <div class="fattura-card ${cardClass}">
                    <div class="fattura-header">
                        <div class="fattura-fornitore">${fattura.fornitore || 'N/A'}</div>
                        <div class="fattura-importo">€${(fattura.importo || 0).toFixed(2)}</div>
                    </div>
                    <div class="fattura-status ${(fattura.stato || 'da-pagare').replace(' ', '-')}">${(fattura.stato || 'da pagare').toUpperCase()}</div>
                    <div class="fattura-details">
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Data Fattura</div>
                            <div class="fattura-detail-value">${fattura.data ? new Date(fattura.data).toLocaleDateString('it-IT') : 'N/A'}</div>
                        </div>
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Scadenza</div>
                            <div class="fattura-detail-value">${fattura.scadenza ? new Date(fattura.scadenza).toLocaleDateString('it-IT') : 'N/A'}</div>
                        </div>
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Pagamento</div>
                            <div class="fattura-detail-value">${fattura.modalita_pagamento || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="fattura-descrizione">${fattura.descrizione || 'Nessuna descrizione'}</div>
                    <div class="fattura-actions">
                        <button class="btn-edit" onclick="modificaFattura(${fattura.id})">Modifica</button>
                        <button class="btn-delete" onclick="eliminaFattura(${fattura.id})">Elimina</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Errore caricamento fatture:', error);
        showNotification('error', 'Errore nel caricamento delle fatture');
    }
}

async function eliminaFattura(id) {
    if (confirm('Sei sicuro di voler eliminare questa fattura?')) {
        try {
            await deleteFromSupabase('fatture', id);
            await mostraFatture();
            
            if (typeof aggiornaDashboardAvanzata === 'function') {
                aggiornaDashboardAvanzata();
            }
        } catch (error) {
            showNotification('error', 'Errore nell\'eliminazione della fattura');
        }
    }
}

function modificaFattura(id) {
    showNotification('info', 'Funzione modifica fattura in sviluppo');
}

// Gestione Fornitori
async function caricaFornitori() {
    try {
        const fornitori = await loadFromSupabase('fornitori');
        const select = document.getElementById('fornitore');
        const filtroSelect = document.getElementById('filtroFornitore');
        
        if (select) {
            select.innerHTML = '<option value="">Seleziona fornitore...</option>';
            fornitori.forEach(fornitore => {
                select.innerHTML += `<option value="${fornitore.nome}">${fornitore.nome}</option>`;
            });
        }
        
        if (filtroSelect) {
            filtroSelect.innerHTML = '<option value="tutti">Tutti i fornitori</option>';
            fornitori.forEach(fornitore => {
                filtroSelect.innerHTML += `<option value="${fornitore.nome}">${fornitore.nome}</option>`;
            });
        }
        
        mostraFornitoriList(fornitori);
    } catch (error) {
        console.error('Errore caricamento fornitori:', error);
    }
}

function mostraFornitoriList(fornitori) {
    const container = document.getElementById('fornitoriList');
    if (!container) return;
    
    container.innerHTML = fornitori.map(fornitore => `
        <div class="fornitore-tag">
            ${fornitore.nome}
            <button class="remove-btn" onclick="eliminaFornitore(${fornitore.id})">×</button>
        </div>
    `).join('');
}

async function aggiungiFornitore() {
    const input = document.getElementById('nuovoFornitore');
    const nome = input?.value.trim();
    
    if (!nome) {
        showNotification('warning', 'Inserisci il nome del fornitore');
        return;
    }
    
    try {
        await saveToSupabase('fornitori', { nome, created_at: new Date().toISOString() });
        showNotification('success', 'Fornitore aggiunto con successo!');
        input.value = '';
        await caricaFornitori();
    } catch (error) {
        showNotification('error', 'Errore nell\'aggiunta del fornitore');
    }
}

async function eliminaFornitore(id) {
    if (confirm('Sei sicuro di voler eliminare questo fornitore?')) {
        try {
            await deleteFromSupabase('fornitori', id);
            await caricaFornitori();
        } catch (error) {
            showNotification('error', 'Errore nell\'eliminazione del fornitore');
        }
    }
}

// Gestione Ricorrenze
async function salvaRicorrenza(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const ricorrenzaData = {
            tipo: formData.get('tipoRicorrenza'),
            nome: formData.get('nomeRicorrenza'),
            importo: parseFloat(formData.get('importoRicorrenza')),
            frequenza: formData.get('frequenzaRicorrenza'),
            created_at: new Date().toISOString()
        };

        await saveToSupabase('ricorrenze', ricorrenzaData);
        showNotification('success', 'Ricorrenza salvata con successo!');
        
        event.target.reset();
        await mostraRicorrenze();
        
        if (typeof aggiornaDashboardAvanzata === 'function') {
            aggiornaDashboardAvanzata();
        }
    } catch (error) {
        showNotification('error', 'Errore nel salvataggio della ricorrenza');
    }
}

async function mostraRicorrenze() {
    try {
        const ricorrenze = await loadFromSupabase('ricorrenze');
        const container = document.getElementById('ricorrenzeContainer');
        
        if (!container) return;

        if (ricorrenze.length === 0) {
            container.innerHTML = '<div class="empty-state">Nessuna ricorrenza presente</div>';
            return;
        }

        container.innerHTML = ricorrenze.map(ricorrenza => `
            <div class="ricorrenza-item">
                <b>${ricorrenza.tipo === 'entrata' ? '💰' : '📤'} ${ricorrenza.nome}</b> - 
                €${ricorrenza.importo.toFixed(2)} - 
                ${ricorrenza.frequenza} 
                <button class="btn-delete" style="margin-left: 10px; padding: 5px 10px;" onclick="eliminaRicorrenza(${ricorrenza.id})">Elimina</button>
            </div>
        `).join('');

    } catch (error) {
        console.error('Errore caricamento ricorrenze:', error);
        showNotification('error', 'Errore nel caricamento delle ricorrenze');
    }
}

async function eliminaRicorrenza(id) {
    if (confirm('Sei sicuro di voler eliminare questa ricorrenza?')) {
        try {
            await deleteFromSupabase('ricorrenze', id);
            await mostraRicorrenze();
            
            if (typeof aggiornaDashboardAvanzata === 'function') {
                aggiornaDashboardAvanzata();
            }
        } catch (error) {
            showNotification('error', 'Errore nell\'eliminazione della ricorrenza');
        }
    }
}

// Calendari
class CalendarChiusure {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        
        if (prevBtn) prevBtn.onclick = () => this.previousMonth();
        if (nextBtn) nextBtn.onclick = () => this.nextMonth();
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }

    async render() {
        const monthEl = document.getElementById('calendarMonth');
        const gridEl = document.getElementById('calendarGrid');
        
        if (!monthEl || !gridEl) return;
        
        monthEl.textContent = this.currentDate.toLocaleDateString('it-IT', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - (firstDay.getDay() || 7) + 1);
        
        gridEl.innerHTML = '';
        
        // Headers
        const headers = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        headers.forEach(header => {
            const headerEl = document.createElement('div');
            headerEl.className = 'calendar-header';
            headerEl.textContent = header;
            gridEl.appendChild(headerEl);
        });
        
        // Carica dati chiusure per il mese
        const chiusure = await loadFromSupabase('chiusure_cassa');
        const chiusureMap = new Map();
        chiusure.forEach(c => {
            chiusureMap.set(c.data, c);
        });
        
        // Days
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = date.getDate();
            
            const dateKey = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === this.currentDate.getMonth();
            const isToday = dateKey === new Date().toISOString().split('T')[0];
            const hasData = chiusureMap.has(dateKey);
            
            if (!isCurrentMonth) {
                dayEl.classList.add('other-month');
            }
            if (isToday) {
                dayEl.classList.add('today');
            }
            if (hasData) {
                dayEl.classList.add('has-data');
            }
            
            dayEl.onclick = () => this.selectDate(date, chiusureMap.get(dateKey));
            gridEl.appendChild(dayEl);
        }
    }

    selectDate(date, chiusuraData) {
        const dateKey = date.toISOString().split('T')[0];
        this.selectedDate = date;
        
        // Update selected day styling
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        event.target.classList.add('selected');
        
        this.showDateDetails(date, chiusuraData);
    }

    showDateDetails(date, chiusuraData) {
        const detailsEl = document.getElementById('calendarDetails');
        if (!detailsEl) return;
        
        const dateStr = date.toLocaleDateString('it-IT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        if (chiusuraData) {
            detailsEl.innerHTML = `
                <h3>📊 Dettagli Chiusura - ${dateStr}</h3>
                <pre>
Scontrinato Totale:     €${(chiusuraData.scontrinato_totale || 0).toFixed(2)}
Scontrinato Contanti:   €${(chiusuraData.scontrinato_contanti || 0).toFixed(2)}
Scontrinato POS:        €${(chiusuraData.scontrinato_pos || 0).toFixed(2)}
Art. 74:                €${(chiusuraData.articolo_74 || 0).toFixed(2)}
Art. 22:                €${(chiusuraData.articolo_22 || 0).toFixed(2)}
Drop POS:               €${(chiusuraData.drop_pos || 0).toFixed(2)}
Drop Cash:              €${(chiusuraData.drop_cash || 0).toFixed(2)}
Monete G. Precedente:   €${(chiusuraData.monete_giorno_precedente || 0).toFixed(2)}
Monete Attuali:         €${(chiusuraData.monete_attuali || 0).toFixed(2)}
Contanti in Cassa:      €${(chiusuraData.contanti_in_cassa || 0).toFixed(2)}
Fondo Cassa:            €${(chiusuraData.fondo_cassa || 0).toFixed(2)}
                </pre>
                <button onclick="window.print()">🖨️ Stampa</button>
                <button onclick="showNotification('info', 'Funzione esportazione in sviluppo')">📥 Esporta</button>
            `;
        } else {
            detailsEl.innerHTML = `
                <h3>📅 ${dateStr}</h3>
                <p style="text-align: center; color: #6c757d; font-style: italic; padding: 40px;">
                    Nessuna chiusura cassa registrata per questa data
                </p>
            `;
        }
    }
}

class CassaCalendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const prevBtn = document.getElementById('cassaPrevMonth');
        const nextBtn = document.getElementById('cassaNextMonth');
        
        if (prevBtn) prevBtn.onclick = () => this.previousMonth();
        if (nextBtn) nextBtn.onclick = () => this.nextMonth();
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }

    async render() {
        const monthEl = document.getElementById('cassaCalendarMonth');
        const gridEl = document.getElementById('cassaCalendarGrid');
        
        if (!monthEl || !gridEl) return;
        
        monthEl.textContent = this.currentDate.toLocaleDateString('it-IT', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - (firstDay.getDay() || 7) + 1);
        
        gridEl.innerHTML = '';
        
        // Headers
        const headers = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        headers.forEach(header => {
            const headerEl = document.createElement('div');
            headerEl.className = 'cassa-calendar-header';
            headerEl.textContent = header;
            gridEl.appendChild(headerEl);
        });
        
        // Carica dati chiusure per il mese
        const chiusure = await loadFromSupabase('chiusure_cassa');
        const chiusureMap = new Map();
        chiusure.forEach(c => {
            chiusureMap.set(c.data, c);
        });
        
        // Days
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayEl = document.createElement('div');
            dayEl.className = 'cassa-calendar-day';
            dayEl.textContent = date.getDate();
            
            const dateKey = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === this.currentDate.getMonth();
            const isToday = dateKey === new Date().toISOString().split('T')[0];
            const hasData = chiusureMap.has(dateKey);
            
            if (!isCurrentMonth) {
                dayEl.classList.add('other-month');
            }
            if (isToday) {
                dayEl.classList.add('today');
            }
            if (hasData) {
                dayEl.classList.add('has-data');
            }
            
            dayEl.onclick = () => this.selectDate(date);
            gridEl.appendChild(dayEl);
        }
    }

    selectDate(date) {
        this.selectedDate = date;
        
        // Update selected day styling
        document.querySelectorAll('.cassa-calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        event.target.classList.add('selected');
        
        const infoEl = document.getElementById('selectedDateInfo');
        if (infoEl) {
            infoEl.textContent = `Data selezionata: ${date.toLocaleDateString('it-IT')}`;
        }
    }
}

// Aggiungi stili per le notifiche
const notificationStyles = `
<style>
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    min-width: 300px;
    max-width: 500px;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    animation: slideInRight 0.3s ease;
    margin-bottom: 10px;
}

.notification.success {
    background: linear-gradient(135deg, #d4edda, #c3e6cb);
    border-left: 4px solid #28a745;
    color: #155724;
}

.notification.error {
    background: linear-gradient(135deg, #f8d7da, #f5c6cb);
    border-left: 4px solid #dc3545;
    color: #721c24;
}

.notification.warning {
    background: linear-gradient(135deg, #fff3cd, #ffeaa7);
    border-left: 4px solid #ffc107;
    color: #856404;
}

.notification.info {
    background: linear-gradient(135deg, #d1ecf1, #bee5eb);
    border-left: 4px solid #17a2b8;
    color: #0c5460;
}

.notification-content {
    display: flex;
    align-items: center;
    padding: 15px 20px;
    gap: 12px;
}

.notification-icon {
    font-size: 1.2em;
    flex-shrink: 0;
}

.notification-message {
    flex: 1;
    font-weight: 600;
}

.notification-close {
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
    flex-shrink: 0;
}

.notification-close:hover {
    opacity: 1;
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
</style>
`;

// Aggiungi gli stili al documento
document.head.insertAdjacentHTML('beforeend', notificationStyles);

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    // Test connessione Supabase
    await testSupabaseConnection();
    
    // Avvia gli aggiornamenti dell'interfaccia
    setInterval(updateModernDateTime, 1000);
    updateModernDateTime();
    
    // Configura la dashboard
    if (document.getElementById('dashboardPeriod')) {
        document.getElementById('dashboardPeriod').onchange = aggiornaDashboardAvanzata;
        await aggiornaDashboardAvanzata();
    }
    
    if (document.getElementById('dashboardYear')) {
        document.getElementById('dashboardYear').onchange = aggiornaDashboardAvanzata;
    }
    
    if (document.getElementById('refreshDashboard')) {
        document.getElementById('refreshDashboard').onclick = aggiornaDashboardAvanzata;
    }
    
    // Carica i dati iniziali
    await caricaFornitori();
    await mostraFatture();
    await mostraRicorrenze();
    
    // Configura i form
    const fatturaForm = document.getElementById('fatturaForm');
    const resetFatturaBtn = document.getElementById('resetFatturaForm');
    if (fatturaForm) fatturaForm.onsubmit = salvaFattura;
    if (resetFatturaBtn) resetFatturaBtn.onclick = () => fatturaForm.reset();
    
        const ricorrenzaForm = document.getElementById('ricorrenzaForm');
    const resetRicorrenzaBtn = document.getElementById('resetRicorrenzaForm');
    if (ricorrenzaForm) ricorrenzaForm.onsubmit = salvaRicorrenza;
    if (resetRicorrenzaBtn) resetRicorrenzaBtn.onclick = () => ricorrenzaForm.reset();
    
    // Inizializza i calendari
    window.calendarChiusure = new CalendarChiusure();
    window.cassaCalendar = new CassaCalendar();
    window.chiusuraCassaSystem = new ChiusuraCassaSystem();
    
    showNotification('success', '🎉 Sistema gestionale online inizializzato con successo!');
    console.log('🎉 Sistema aziendale con Supabase inizializzato con successo!');
});

