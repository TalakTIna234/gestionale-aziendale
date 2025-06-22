// Configurazione Supabase
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js'

const supabaseUrl = 'https://fodowfardgribthpgxxs.supabase.co'  // Sostituisci con il tuo URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvZG93ZmFyZGdyaWJ0aHBneHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1OTkyNzIsImV4cCI6MjA2NjE3NTI3Mn0.KXvV_Lzve4sUNzM79Zp31kuzos4jGTIRqGV0UGewLfk'  // Sostituisci con la tua chiave
const supabase = createClient(supabaseUrl, supabaseKey)

// Funzioni di gestione database
async function salvaChiusura(data) {
    try {
        const chiusuraData = {
            data: data.data,
            scontrinato_totale: parseFloat(data.scontrinatoTotale) || 0,
            scontrinato_contanti: parseFloat(data.scontrinatoContanti) || 0,
            scontrinato_pos: parseFloat(data.scontrinatoPOS) || 0,
            art_74: parseFloat(data.art74) || 0,
            art_22: parseFloat(data.art22) || 0,
            drop_pos: parseFloat(data.dropPOS) || 0,
            drop_cash: parseFloat(data.dropCash) || 0,
            monete_precedenti: parseFloat(data.monetePrecedenti) || 0,
            monete_attuali: parseFloat(data.moneteAttuali) || 0
        };

        const { error } = await supabase
            .from('chiusure')
            .upsert([chiusuraData], { 
                onConflict: 'data',
                ignoreDuplicates: false 
            });
        
        if (error) throw error;
        
        showNotification('success', 'Chiusura salvata con successo nel database!');
        return true;
    } catch (error) {
        console.error('Errore salvataggio:', error);
        showNotification('error', 'Errore nel salvare: ' + error.message);
        // Fallback a localStorage
        localStorage.setItem(`chiusura_${data.data}`, JSON.stringify(data));
        showNotification('warning', 'Salvato in locale come backup');
        return false;
    }
}

async function caricaChiusura(data) {
    try {
        const { data: chiusura, error } = await supabase
            .from('chiusure')
            .select('*')
            .eq('data', data)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        if (chiusura) {
            return {
                data: chiusura.data,
                scontrinatoTotale: chiusura.scontrinato_totale,
                scontrinatoContanti: chiusura.scontrinato_contanti,
                scontrinatoPOS: chiusura.scontrinato_pos,
                art74: chiusura.art_74,
                art22: chiusura.art_22,
                dropPOS: chiusura.drop_pos,
                dropCash: chiusura.drop_cash,
                monetePrecedenti: chiusura.monete_precedenti,
                moneteAttuali: chiusura.monete_attuali
            };
        }
        
        return null;
    } catch (error) {
        console.error('Errore caricamento:', error);
        // Fallback a localStorage
        const localData = localStorage.getItem(`chiusura_${data}`);
        return localData ? JSON.parse(localData) : null;
    }
}

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
            const todayData = await caricaChiusura(today);
            if (todayData) {
                revenueEl.textContent = `€${(todayData.scontrinatoTotale || 0).toFixed(0)}`;
            } else {
                revenueEl.textContent = '€0';
            }
        } catch (error) {
            // Fallback a localStorage
            const localData = localStorage.getItem(`chiusura_${today}`);
            if (localData) {
                const data = JSON.parse(localData);
                revenueEl.textContent = `€${(data.scontrinatoTotale || 0).toFixed(0)}`;
            } else {
                revenueEl.textContent = '€0';
            }
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
    let chiusure = [];
    
    try {
        // Carica chiusure dal database invece che da localStorage
        const { data: chiusureDB, error } = await supabase
            .from('chiusure')
            .select('*')
            .gte('data', start.toISOString().split('T')[0])
            .lte('data', end.toISOString().split('T')[0])
            .order('data', { ascending: true });
        
        if (error) throw error;
        
        chiusure = chiusureDB.map(c => ({
            data: c.data,
            scontrinatoTotale: c.scontrinato_totale || 0,
            scontrinatoContanti: c.scontrinato_contanti || 0,
            scontrinatoPOS: c.scontrinato_pos || 0,
            art74: c.art_74 || 0,
            art22: c.art_22 || 0,
            dropPOS: c.drop_pos || 0,
            dropCash: c.drop_cash || 0,
            monetePrecedenti: c.monete_precedenti || 0,
            moneteAttuali: c.monete_attuali || 0
        }));
    } catch (error) {
        console.error('Errore caricamento dati finanziari:', error);
        // Fallback a localStorage se il database non è disponibile
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

async function aggiornaGrafici(dati, period, year) {
    Object.values(dashboardCharts).forEach(chart => {
        if (chart && chart.destroy) chart.destroy();
    });
    
    if (typeof Chart !== 'undefined') {
        await creaGraficoAndamentoMensile(dati, year);
        creaGraficoDistribuzioneEntrate(dati);
        creaGraficoAnalisiSpese(dati);
        await creaGraficoTrendIVA(dati, year);
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
        const datiMese = await raccogliDatiFinanziari(inizioMese, fineMese);
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
        const datiMese = await raccogliDatiFinanziari(inizioMese, fineMese);
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
                <span style="font-size: 1.2em; margin-right: 10px;">${alert.icon}</span>
                ${alert.message}
            </div>
        `).join('') : 
        '<div class="empty-state">🎯 Tutto sotto controllo! Nessun alert da segnalare.</div>';
}

// Resto del codice rimane identico fino alla classe ChiusuraCassaSystem
function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    switch(type) {
        case 'success': notification.style.background = '#28a745'; break;
        case 'error': notification.style.background = '#dc3545'; break;
        case 'warning': notification.style.background = '#ffc107'; notification.style.color = '#000'; break;
        case 'info': notification.style.background = '#17a2b8'; break;
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Funzioni per fatture e fornitori (rimangono identiche)
function caricaFornitori() {
    const fornitori = JSON.parse(localStorage.getItem('fornitori') || '[]');
    const container = document.getElementById('fornitoriList');
    const select = document.getElementById('fatturaFornitore');
    const filtroSelect = document.getElementById('filtroFornitore');
    
    if (container) {
        container.innerHTML = fornitori.map(f => `
            <span class="fornitore-tag">
                ${f}
                <button class="remove-btn" onclick="rimuoviFornitore('${f}')">×</button>
            </span>
        `).join('');
    }
    
    if (select) {
        select.innerHTML = '<option value="">Seleziona fornitore...</option>' +
            fornitori.map(f => `<option value="${f}">${f}</option>`).join('');
    }
    
    if (filtroSelect) {
        filtroSelect.innerHTML = '<option value="">Tutti i fornitori</option>' +
            fornitori.map(f => `<option value="${f}">${f}</option>`).join('');
    }
}

function aggiungiFornitore() {
    const input = document.getElementById('nuovoFornitore');
    const nome = input.value.trim();
    
    if (!nome) return;
    
    let fornitori = JSON.parse(localStorage.getItem('fornitori') || '[]');
    if (!fornitori.includes(nome)) {
        fornitori.push(nome);
        localStorage.setItem('fornitori', JSON.stringify(fornitori));
        caricaFornitori();
        input.value = '';
        showNotification('success', 'Fornitore aggiunto con successo!');
    } else {
        showNotification('warning', 'Fornitore già esistente!');
    }
}

function rimuoviFornitore(nome) {
    let fornitori = JSON.parse(localStorage.getItem('fornitori') || '[]');
    fornitori = fornitori.filter(f => f !== nome);
    localStorage.setItem('fornitori', JSON.stringify(fornitori));
    caricaFornitori();
    showNotification('success', 'Fornitore rimosso!');
}

function salvaFattura(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const fattura = {
        id: Date.now(),
        fornitore: formData.get('fornitore'),
        importo: parseFloat(formData.get('importo')),
        descrizione: formData.get('descrizione'),
        data: formData.get('data') || new Date().toISOString().split('T')[0],
        dataFattura: formData.get('dataFattura'),
        scadenza: formData.get('scadenza'),
        modalitaPagamento: formData.get('modalitaPagamento'),
        stato: formData.get('stato') || 'da pagare'
    };
    
    if (!fattura.fornitore || !fattura.importo || !fattura.dataFattura || !fattura.scadenza) {
        showNotification('error', 'Compila tutti i campi obbligatori!');
        return;
    }
    
    let fatture = JSON.parse(localStorage.getItem('fatture') || '[]');
    fatture.push(fattura);
    localStorage.setItem('fatture', JSON.stringify(fatture));
    
    e.target.reset();
    mostraFatture();
    showNotification('success', 'Fattura salvata con successo!');
}

function resetFatturaForm() {
    document.getElementById('fatturaForm').reset();
}

function mostraFatture() {
    const fatture = JSON.parse(localStorage.getItem('fatture') || '[]');
    const container = document.getElementById('fattureGrid');
    
    if (!container) return;
    
    const filtroStato = document.getElementById('filtroStato')?.value || '';
    const filtroFornitore = document.getElementById('filtroFornitore')?.value || '';
    const filtroRicerca = document.getElementById('filtroRicerca')?.value.toLowerCase() || '';
    
    const fattureFiltrate = fatture.filter(f => {
        const matchStato = !filtroStato || f.stato === filtroStato;
        const matchFornitore = !filtroFornitore || f.fornitore === filtroFornitore;
        const matchRicerca = !filtroRicerca || 
            f.fornitore.toLowerCase().includes(filtroRicerca) ||
            f.descrizione.toLowerCase().includes(filtroRicerca);
        
        return matchStato && matchFornitore && matchRicerca;
    });
    
    if (fattureFiltrate.length === 0) {
        container.innerHTML = '<div class="empty-state">📄 Nessuna fattura trovata con i filtri selezionati</div>';
        return;
    }
    
    container.innerHTML = fattureFiltrate.map(f => {
        const scadenza = new Date(f.scadenza);
        const oggi = new Date();
        const isScaduta = f.stato === 'da pagare' && scadenza < oggi;
        const cardClass = f.stato === 'pagata' ? 'pagata' : (isScaduta ? 'scaduta' : '');
        
        return `
            <div class="fattura-card ${cardClass}">
                <div class="fattura-header">
                    <div class="fattura-fornitore">${f.fornitore}</div>
                    <div class="fattura-importo">€${f.importo.toFixed(2)}</div>
                </div>
                <div class="fattura-status ${f.stato.replace(' ', '-')}">${f.stato.toUpperCase()}</div>
                <div class="fattura-details">
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Data Fattura</div>
                        <div class="fattura-detail-value">${new Date(f.dataFattura).toLocaleDateString('it-IT')}</div>
                    </div>
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Scadenza</div>
                        <div class="fattura-detail-value">${scadenza.toLocaleDateString('it-IT')}</div>
                    </div>
                    <div class="fattura-detail">
                        <div class="fattura-detail-label">Pagamento</div>
                        <div class="fattura-detail-value">${f.modalitaPagamento}</div>
                    </div>
                </div>
                <div class="fattura-details">
                    <div class="fattura-detail" style="grid-column: 1/-1;">
                        <div class="fattura-detail-label">Descrizione</div>
                        <div class="fattura-detail-value">${f.descrizione || 'N/A'}</div>
                    </div>
                </div>
                <div class="fattura-actions">
                    <button class="btn-edit" onclick="modificaStatoFattura(${f.id})">
                        ${f.stato === 'da pagare' ? '✅ Segna Pagata' : '⏳ Segna Da Pagare'}
                    </button>
                    <button class="btn-delete" onclick="eliminaFattura(${f.id})">🗑️ Elimina</button>
                </div>
            </div>
        `;
    }).join('');
}

function modificaStatoFattura(id) {
    let fatture = JSON.parse(localStorage.getItem('fatture') || '[]');
    const fattura = fatture.find(f => f.id === id);
    
    if (fattura) {
        fattura.stato = fattura.stato === 'da pagare' ? 'pagata' : 'da pagare';
        localStorage.setItem('fatture', JSON.stringify(fatture));
        mostraFatture();
        showNotification('success', `Fattura ${fattura.stato === 'pagata' ? 'segnata come pagata' : 'segnata come da pagare'}!`);
    }
}

function eliminaFattura(id) {
    if (confirm('Sei sicuro di voler eliminare questa fattura?')) {
        let fatture = JSON.parse(localStorage.getItem('fatture') || '[]');
        fatture = fatture.filter(f => f.id !== id);
        localStorage.setItem('fatture', JSON.stringify(fatture));
        mostraFatture();
        showNotification('success', 'Fattura eliminata!');
    }
}

function salvaRicorrenza(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const ricorrenza = {
        id: Date.now(),
        tipo: formData.get('tipo'),
        nome: formData.get('nome'),
        importo: parseFloat(formData.get('importo')),
        frequenza: formData.get('frequenza')
    };
    
    if (!ricorrenza.nome || !ricorrenza.importo) {
        showNotification('error', 'Compila tutti i campi!');
        return;
    }
    
    let ricorrenze = JSON.parse(localStorage.getItem('ricorrenze') || '[]');
    ricorrenze.push(ricorrenza);
    localStorage.setItem('ricorrenze', JSON.stringify(ricorrenze));
    
    e.target.reset();
    mostraRicorrenze();
    showNotification('success', 'Ricorrenza salvata con successo!');
}

function mostraRicorrenze() {
    const ricorrenze = JSON.parse(localStorage.getItem('ricorrenze') || '[]');
    const container = document.getElementById('ricorrenzeList');
    
    if (!container) return;
    
    if (ricorrenze.length === 0) {
        container.innerHTML = '<div class="empty-state">🔁 Nessuna ricorrenza configurata</div>';
        return;
    }
    
    container.innerHTML = ricorrenze.map(r => `
        <div class="ricorrenza-item">
            <b>${r.nome}</b> - €${r.importo.toFixed(2)} 
            (${r.tipo === 'entrata' ? '💰 Entrata' : '📤 Uscita'} - ${r.frequenza})
            <button class="btn-delete" style="float: right; padding: 5px 10px; font-size: 0.8em;" 
                    onclick="eliminaRicorrenza(${r.id})">🗑️</button>
        </div>
    `).join('');
}

function eliminaRicorrenza(id) {
    if (confirm('Sei sicuro di voler eliminare questa ricorrenza?')) {
        let ricorrenze = JSON.parse(localStorage.getItem('ricorrenze') || '[]');
        ricorrenze = ricorrenze.filter(r => r.id !== id);
        localStorage.setItem('ricorrenze', JSON.stringify(ricorrenze));
        mostraRicorrenze();
        showNotification('success', 'Ricorrenza eliminata!');
    }
}

// Classi per calendario e chiusura cassa (con modifiche per database)
class CalendarChiusure {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.init();
    }
    
    init() {
        this.render();
        this.bindEvents();
    }
    
    bindEvents() {
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
        const startDay = firstDay.getDay() || 7;
        
        let html = '';
        const headers = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        headers.forEach(h => html += `<div class="calendar-header">${h}</div>`);
        
        // Giorni del mese precedente
        for (let i = startDay - 1; i > 1; i--) {
            const prevDate = new Date(firstDay);
            prevDate.setDate(prevDate.getDate() - i + 1);
            html += `<div class="calendar-day other-month">${prevDate.getDate()}</div>`;
        }
        
        // Giorni del mese corrente
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            
            // Controlla se ci sono dati per questo giorno (prima nel database, poi localStorage)
            let hasData = false;
            try {
                const chiusura = await caricaChiusura(dateStr);
                hasData = !!chiusura;
            } catch (error) {
                // Fallback a localStorage
                hasData = !!localStorage.getItem(`chiusura_${dateStr}`);
            }
            
            const classes = ['calendar-day'];
            if (isToday) classes.push('today');
            if (hasData) classes.push('has-data');
            
            html += `<div class="${classes.join(' ')}" data-date="${dateStr}" onclick="window.calendarChiusure.selectDate('${dateStr}')">${day}</div>`;
        }
        
        // Giorni del mese successivo
        const remainingCells = 42 - (startDay - 1) - lastDay.getDate();
        for (let day = 1; day <= remainingCells; day++) {
            html += `<div class="calendar-day other-month">${day}</div>`;
        }
        
        gridEl.innerHTML = html;
    }
    
    async selectDate(dateStr) {
        this.selectedDate = dateStr;
        
        // Rimuovi selezione precedente
        document.querySelectorAll('.calendar-day.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Aggiungi selezione corrente
        const selectedEl = document.querySelector(`[data-date="${dateStr}"]`);
        if (selectedEl) selectedEl.classList.add('selected');
        
        await this.showDateDetails(dateStr);
    }
    
    async showDateDetails(dateStr) {
        const detailsEl = document.getElementById('calendarDetails');
        if (!detailsEl) return;
        
        try {
            const data = await caricaChiusura(dateStr);
            
            if (data) {
                const date = new Date(dateStr);
                detailsEl.innerHTML = `
                    <h3>📊 Chiusura del ${date.toLocaleDateString('it-IT')}</h3>
                    <pre>
Scontrinato Totale:     €${(data.scontrinatoTotale || 0).toFixed(2)}
  - Contanti:           €${(data.scontrinatoContanti || 0).toFixed(2)}
  - POS:                €${(data.scontrinatoPOS || 0).toFixed(2)}

Articoli:
  - Art. 74:            €${(data.art74 || 0).toFixed(2)}
  - Art. 22:            €${(data.art22 || 0).toFixed(2)}

Drop:
  - POS:                €${(data.dropPOS || 0).toFixed(2)}
  - Cash:               €${(data.dropCash || 0).toFixed(2)}

Monete:
  - Precedenti:         €${(data.monetePrecedenti || 0).toFixed(2)}
  - Attuali:            €${(data.moneteAttuali || 0).toFixed(2)}
                    </pre>
                    <button onclick="window.calendarChiusure.printDay('${dateStr}')">🖨️ Stampa</button>
                    <button onclick="window.calendarChiusure.exportDay('${dateStr}')">📥 Esporta</button>
                `;
            } else {
                const date = new Date(dateStr);
                detailsEl.innerHTML = `
                    <h3>📅 ${date.toLocaleDateString('it-IT')}</h3>
                    <p style="text-align: center; color: #6c757d; font-style: italic; margin: 40px 0;">
                        Nessuna chiusura registrata per questo giorno
                    </p>
                `;
            }
        } catch (error) {
            console.error('Errore nel caricamento dettagli:', error);
            detailsEl.innerHTML = `
                <h3>❌ Errore</h3>
                <p style="text-align: center; color: #dc3545;">
                    Errore nel caricamento dei dati per questa data
                </p>
            `;
        }
    }
    
    async printDay(dateStr) {
        const data = await caricaChiusura(dateStr);
        if (!data) return;
        
        const printWindow = window.open('', '_blank');
        const date = new Date(dateStr);
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Chiusura ${date.toLocaleDateString('it-IT')}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #2c3e50; }
                        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <h1>📊 Chiusura del ${date.toLocaleDateString('it-IT')}</h1>
                    <pre>
Scontrinato Totale:     €${(data.scontrinatoTotale || 0).toFixed(2)}
  - Contanti:           €${(data.scontrinatoContanti || 0).toFixed(2)}
  - POS:                €${(data.scontrinatoPOS || 0).toFixed(2)}

Articoli:
  - Art. 74:            €${(data.art74 || 0).toFixed(2)}
  - Art. 22:            €${(data.art22 || 0).toFixed(2)}

Drop:
  - POS:                €${(data.dropPOS || 0).toFixed(2)}
  - Cash:               €${(data.dropCash || 0).toFixed(2)}

Monete:
  - Precedenti:         €${(data.monetePrecedenti || 0).toFixed(2)}
  - Attuali:            €${(data.moneteAttuali || 0).toFixed(2)}
                    </pre>
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    }
    
    async exportDay(dateStr) {
        const data = await caricaChiusura(dateStr);
        if (!data) return;
        
        const date = new Date(dateStr);
        const filename = `chiusura_${dateStr}.json`;
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('success', `Dati esportati: ${filename}`);
    }
}

class CassaCalendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.init();
    }
    
    init() {
        this.render();
        this.bindEvents();
        this.updateSelectedDateInfo();
    }
    
    bindEvents() {
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
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDay = firstDay.getDay() || 7;
        
        let html = '';
        const headers = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        headers.forEach(h => html += `<div class="cassa-calendar-header">${h}</div>`);
        
        // Giorni del mese precedente
        for (let i = startDay - 1; i > 1; i--) {
            const prevDate = new Date(firstDay);
            prevDate.setDate(prevDate.getDate() - i + 1);
            html += `<div class="cassa-calendar-day other-month">${prevDate.getDate()}</div>`;
        }
        
        // Giorni del mese corrente
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isSelected = dateStr === this.selectedDate;
            
            // Controlla se ci sono dati per questo giorno
            let hasData = false;
            try {
                const chiusura = await caricaChiusura(dateStr);
                hasData = !!chiusura;
            } catch (error) {
                hasData = !!localStorage.getItem(`chiusura_${dateStr}`);
            }
            
            const classes = ['cassa-calendar-day'];
            if (isToday) classes.push('today');
            if (isSelected) classes.push('selected');
            if (hasData) classes.push('has-data');
            
            html += `<div class="${classes.join(' ')}" data-date="${dateStr}" onclick="window.cassaCalendar.selectDate('${dateStr}')">${day}</div>`;
        }
        
        // Giorni del mese successivo
        const remainingCells = 42 - (startDay - 1) - lastDay.getDate();
        for (let day = 1; day <= remainingCells; day++) {
            html += `<div class="cassa-calendar-day other-month">${day}</div>`;
        }
        
        gridEl.innerHTML = html;
    }
    
    selectDate(dateStr) {
        this.selectedDate = dateStr;
        this.render();
        this.updateSelectedDateInfo();
        
        // Aggiorna la data nel form di chiusura cassa
        const dateInput = document.getElementById('data');
        if (dateInput) {
            dateInput.value = dateStr;
            // Carica i dati per questa data se esistono
            if (window.chiusuraCassaSystem) {
                window.chiusuraCassaSystem.loadData(dateStr);
            }
        }
    }
    
    updateSelectedDateInfo() {
        const infoEl = document.getElementById('selectedDateInfo');
        if (infoEl && this.selectedDate) {
            const date = new Date(this.selectedDate);
            infoEl.textContent = `Data selezionata: ${date.toLocaleDateString('it-IT')}`;
        }
    }
}

class ChiusuraCassaSystem {
    constructor() {
        this.form = document.getElementById('chiusuraForm');
        this.modal = document.getElementById('chiusuraModal');
        this.statusIndicator = document.querySelector('.status-indicator');
        this.verificationResult = document.getElementById('verificationResult');
        this.articoliVerification = document.getElementById('articoliVerification');
        this.fondoCassaResult = document.getElementById('fondoCassaResult');
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadTodayData();
        this.updateCalculations();
    }
    
    bindEvents() {
        // Auto-calcolo quando cambiano i valori
        const inputs = this.form?.querySelectorAll('input[type="number"]') || [];
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateCalculations());
            input.addEventListener('change', () => this.updateCalculations());
        });
        
        // Bottoni azione
        const saveBtn = document.getElementById('salvaChiusura');
        const verifyBtn = document.getElementById('verificaCompleta');
        const exportBtn = document.getElementById('esportaReport');
        
        if (saveBtn) saveBtn.onclick = () => this.saveData();
        if (verifyBtn) verifyBtn.onclick = () => this.verifyComplete();
        if (exportBtn) exportBtn.onclick = () => this.exportReport();
        
        // Chiusura modale
        const closeBtn = this.modal?.querySelector('.close');
        if (closeBtn) closeBtn.onclick = () => this.closeModal();
        
        // Data picker
        const dataInput = document.getElementById('data');
        if (dataInput) {
            dataInput.value = new Date().toISOString().split('T')[0];
            dataInput.onchange = () => this.loadData(dataInput.value);
        }
    }
    
    async loadTodayData() {
        const today = new Date().toISOString().split('T')[0];
        await this.loadData(today);
    }
    
    async loadData(date) {
        try {
            const data = await caricaChiusura(date);
            if (data) {
                // Popola i campi del form con i dati caricati
                Object.keys(data).forEach(key => {
                    const input = document.getElementById(key);
                    if (input && key !== 'data') {
                        input.value = data[key] || '';
                    }
                });
                this.updateCalculations();
                this.updateStatus('ok', 'Dati caricati dal database');
                return data;
            } else {
                // Resetta il form se non ci sono dati
                const inputs = this.form?.querySelectorAll('input[type="number"]') || [];
                inputs.forEach(input => input.value = '');
                this.updateCalculations();
                this.updateStatus('info', 'Nessun dato trovato per questa data');
            }
        } catch (error) {
            console.error('Errore nel caricamento:', error);
            this.updateStatus('error', 'Errore nel caricamento dati');
        }
        return null;
    }
    
    updateCalculations() {
        const getValue = (id) => parseFloat(document.getElementById(id)?.value || 0);
        
        // Calcoli principali
        const scontrinatoTotale = getValue('scontrinatoTotale');
        const scontrinatoContanti = getValue('scontrinatoContanti');
        const scontrinatoPOS = getValue('scontrinatoPOS');
        const art74 = getValue('art74');
        const art22 = getValue('art22');
        const dropPOS = getValue('dropPOS');
        const dropCash = getValue('dropCash');
        const monetePrecedenti = getValue('monetePrecedenti');
        const moneteAttuali = getValue('moneteAttuali');
        
        // Verifica coerenza scontrinato
        const sommaDettaglio = scontrinatoContanti + scontrinatoPOS;
        const differenzaScontrinato = Math.abs(scontrinatoTotale - sommaDettaglio);
        
        if (this.verificationResult) {
            if (differenzaScontrinato < 0.01) {
                this.verificationResult.className = 'verification-result success';
                this.verificationResult.textContent = '✅ Scontrinato verificato correttamente';
            } else {
                this.verificationResult.className = 'verification-result error';
                this.verificationResult.textContent = `❌ Differenza scontrinato: €${differenzaScontrinato.toFixed(2)}`;
            }
        }
        
        // Verifica articoli
        const sommaArticoli = art74 + art22;
        if (this.articoliVerification) {
            if (sommaArticoli > 0) {
                this.articoliVerification.className = 'articoli-verification success';
                this.articoliVerification.textContent = `✅ Articoli registrati: €${sommaArticoli.toFixed(2)}`;
            } else {
                this.articoliVerification.className = 'articoli-verification error';
                this.articoliVerification.textContent = '⚠️ Nessun articolo registrato';
            }
        }
        
        // Calcolo contanti in cassa
        const totaleContanti = scontrinatoContanti + dropCash + (moneteAttuali - monetePrecedenti);
        const contantiEl = document.getElementById('totaleContanti');
        if (contantiEl) contantiEl.textContent = `€${totaleContanti.toFixed(2)}`;
        
        // Calcolo fondo cassa
        const fondoCassa = totaleContanti - scontrinatoContanti - dropCash + (moneteAttuali - monetePrecedenti) - 100;
        
        if (this.fondoCassaResult) {
            this.fondoCassaResult.innerHTML = `
                <div class="formula">
                    Fondo Cassa = Contanti in Cassa - Scontrinato Contanti - Drop Cash + Differenza Monete - 100
                </div>
                <div class="result-value">€${fondoCassa.toFixed(2)}</div>
                <div class="result-interpretation ${this.getResultClass(fondoCassa)}">
                    ${this.getResultInterpretation(fondoCassa)}
                </div>
            `;
        }
        
        // Aggiorna status generale
        this.updateStatus(this.getOverallStatus(), 'Calcoli aggiornati');
    }
    
    getResultClass(fondoCassa) {
        if (Math.abs(fondoCassa) < 1) return 'perfect';
        if (Math.abs(fondoCassa) < 50) return 'warning';
        return 'danger';
    }
    
    getResultInterpretation(fondoCassa) {
        if (Math.abs(fondoCassa) < 1) return '🎯 Perfetto! Fondo cassa bilanciato';
        if (fondoCassa > 0) return `💰 Eccedenza di €${fondoCassa.toFixed(2)}`;
        return `⚠️ Mancanza di €${Math.abs(fondoCassa).toFixed(2)}`;
    }
    
    async saveData() {
        const formData = new FormData(this.form);
        const data = {
            data: formData.get('data'),
            scontrinatoTotale: parseFloat(formData.get('scontrinatoTotale') || 0),
            scontrinatoContanti: parseFloat(formData.get('scontrinatoContanti') || 0),
            scontrinatoPOS: parseFloat(formData.get('scontrinatoPOS') || 0),
            art74: parseFloat(formData.get('art74') || 0),
            art22: parseFloat(formData.get('art22') || 0),
            dropPOS: parseFloat(formData.get('dropPOS') || 0),
            dropCash: parseFloat(formData.get('dropCash') || 0),
            monetePrecedenti: parseFloat(formData.get('monetePrecedenti') || 0),
            moneteAttuali: parseFloat(formData.get('moneteAttuali') || 0)
        };
        
        const success = await salvaChiusura(data);
        if (success) {
            this.showModal('success', 'Chiusura salvata con successo nel database cloud!');
            this.updateStatus('ok', 'Dati salvati nel database');
            
             // Aggiorna il calendario se esiste
            if (window.calendarChiusure) {
                window.calendarChiusure.render();
            }
            if (window.cassaCalendar) {
                window.cassaCalendar.render();
            }
        } else {
            this.showModal('error', 'Errore nel salvare la chiusura');
            this.updateStatus('error', 'Errore nel salvataggio');
        }
    }
    
    verifyComplete() {
        this.updateCalculations();
        
        const getValue = (id) => parseFloat(document.getElementById(id)?.value || 0);
        const scontrinatoTotale = getValue('scontrinatoTotale');
        const scontrinatoContanti = getValue('scontrinatoContanti');
        const scontrinatoPOS = getValue('scontrinatoPOS');
        
        const differenzaScontrinato = Math.abs(scontrinatoTotale - (scontrinatoContanti + scontrinatoPOS));
        
        if (differenzaScontrinato < 0.01) {
            this.showModal('success', '✅ Verifica completata con successo! Tutti i calcoli sono corretti.');
        } else {
            this.showModal('error', `❌ Verifica fallita! Differenza scontrinato: €${differenzaScontrinato.toFixed(2)}`);
        }
    }
    
    exportReport() {
        const formData = new FormData(this.form);
        const data = {
            data: formData.get('data'),
            scontrinatoTotale: parseFloat(formData.get('scontrinatoTotale') || 0),
            scontrinatoContanti: parseFloat(formData.get('scontrinatoContanti') || 0),
            scontrinatoPOS: parseFloat(formData.get('scontrinatoPOS') || 0),
            art74: parseFloat(formData.get('art74') || 0),
            art22: parseFloat(formData.get('art22') || 0),
            dropPOS: parseFloat(formData.get('dropPOS') || 0),
            dropCash: parseFloat(formData.get('dropCash') || 0),
            monetePrecedenti: parseFloat(formData.get('monetePrecedenti') || 0),
            moneteAttuali: parseFloat(formData.get('moneteAttuali') || 0)
        };
        
        const report = `
REPORT CHIUSURA CASSA - ${new Date(data.data).toLocaleDateString('it-IT')}
================================================================

SCONTRINATO:
- Totale:           €${data.scontrinatoTotale.toFixed(2)}
- Contanti:         €${data.scontrinatoContanti.toFixed(2)}
- POS:              €${data.scontrinatoPOS.toFixed(2)}

ARTICOLI:
- Art. 74:          €${data.art74.toFixed(2)}
- Art. 22:          €${data.art22.toFixed(2)}

DROP:
- POS:              €${data.dropPOS.toFixed(2)}
- Cash:             €${data.dropCash.toFixed(2)}

MONETE:
- Precedenti:       €${data.monetePrecedenti.toFixed(2)}
- Attuali:          €${data.moneteAttuali.toFixed(2)}
- Differenza:       €${(data.moneteAttuali - data.monetePrecedenti).toFixed(2)}

CALCOLI:
- Contanti in Cassa: €${(data.scontrinatoContanti + data.dropCash + (data.moneteAttuali - data.monetePrecedenti)).toFixed(2)}
- Fondo Cassa:      €${(data.scontrinatoContanti + data.dropCash + (data.moneteAttuali - data.monetePrecedenti) - data.scontrinatoContanti - data.dropCash + (data.moneteAttuali - data.monetePrecedenti) - 100).toFixed(2)}

================================================================
Report generato il ${new Date().toLocaleString('it-IT')}
        `;
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_chiusura_${data.data}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('success', 'Report esportato con successo!');
    }
    
    showModal(type, message) {
        const modalBody = this.modal?.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="modal-icon ${type}">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </div>
                <p>${message}</p>
            `;
        }
        if (this.modal) this.modal.style.display = 'block';
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

// Inizializzazione del sistema
document.addEventListener('DOMContentLoaded', async () => {
    setInterval(updateModernDateTime, 1000);
    updateModernDateTime();
    aggiornaDataOra();
    setInterval(aggiornaDataOra, 1000);
    
    if (document.getElementById('dashboardPeriod')) {
        document.getElementById('dashboardPeriod').onchange = () => aggiornaDashboardAvanzata();
        await aggiornaDashboardAvanzata();
    }
    
    if (document.getElementById('dashboardYear')) {
        document.getElementById('dashboardYear').onchange = () => aggiornaDashboardAvanzata();
    }
    
    if (document.getElementById('refreshDashboard')) {
        document.getElementById('refreshDashboard').onclick = () => aggiornaDashboardAvanzata();
    }
    
    // Inizializzazione sezioni
    caricaFornitori();
    mostraFatture();
    mostraRicorrenze();
    
    // Event listeners per fornitori
    const aggiungiFornitoreBtn = document.getElementById('aggiungiFornitore');
    const nuovoFornitoreInput = document.getElementById('nuovoFornitore');
    
    if (aggiungiFornitoreBtn) aggiungiFornitoreBtn.onclick = aggiungiFornitore;
    if (nuovoFornitoreInput) {
        nuovoFornitoreInput.onkeypress = (e) => {
            if (e.key === 'Enter') aggiungiFornitore();
        };
    }
    
    // Event listeners per fatture
    const fatturaForm = document.getElementById('fatturaForm');
    const resetFatturaBtn = document.getElementById('resetFatturaForm');
    
    if (fatturaForm) fatturaForm.onsubmit = salvaFattura;
    if (resetFatturaBtn) resetFatturaBtn.onclick = resetFatturaForm;
    
    // Event listeners per filtri fatture
    const filtroStato = document.getElementById('filtroStato');
    const filtroFornitore = document.getElementById('filtroFornitore');
    const filtroRicerca = document.getElementById('filtroRicerca');
    
    if (filtroStato) filtroStato.onchange = mostraFatture;
    if (filtroFornitore) filtroFornitore.onchange = mostraFatture;
    if (filtroRicerca) filtroRicerca.oninput = mostraFatture;
    
    // Event listeners per ricorrenze
    const ricorrenzaForm = document.getElementById('ricorrenzaForm');
    const resetRicorrenzaBtn = document.getElementById('resetRicorrenzaForm');
    
    if (ricorrenzaForm) ricorrenzaForm.onsubmit = salvaRicorrenza;
    if (resetRicorrenzaBtn) resetRicorrenzaBtn.onclick = () => ricorrenzaForm.reset();
    
    // Inizializzazione calendari e sistema chiusura cassa
    window.calendarChiusure = new CalendarChiusure();
    window.cassaCalendar = new CassaCalendar();
    window.chiusuraCassaSystem = new ChiusuraCassaSystem();
    
    console.log('🎉 Sistema aziendale con database Supabase inizializzato con successo!');
});

// Funzione di aggiornamento data/ora (se non già presente)
function aggiornaDataOra() {
    const now = new Date();
    const dateTimeEl = document.getElementById('currentDateTime');
    if (dateTimeEl) {
        dateTimeEl.textContent = now.toLocaleString('it-IT');
    }
}

