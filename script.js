// Database functions per Supabase
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
                    // Update existing record
                    result = await supabase
                        .from(table)
                        .update(data)
                        .eq('id', key)
                        .select();
                } else {
                    // Insert new record
                    result = await supabase
                        .from(table)
                        .insert([data])
                        .select();
                }
                
                if (result.error) {
                    throw result.error;
                }
                
                return result.data[0];
            } catch (error) {
                console.error('Errore Supabase:', error);
                // Fallback to localStorage
                return this.saveToLocalStorage(table, data, key);
            }
        } else {
            return this.saveToLocalStorage(table, data, key);
        }
    }

    async loadData(table, filters = null) {
        if (USE_SUPABASE && this.isOnline) {
            try {
                let query = supabase.from(table).select('*');
                
                if (filters) {
                    Object.entries(filters).forEach(([key, value]) => {
                        query = query.eq(key, value);
                    });
                }
                
                const result = await query;
                
                if (result.error) {
                    throw result.error;
                }
                
                return result.data || [];
            } catch (error) {
                console.error('Errore caricamento Supabase:', error);
                // Fallback to localStorage
                return this.loadFromLocalStorage(table);
            }
        } else {
            return this.loadFromLocalStorage(table);
        }
    }

    async deleteData(table, id) {
        if (USE_SUPABASE && this.isOnline) {
            try {
                const result = await supabase
                    .from(table)
                    .delete()
                    .eq('id', id);
                
                if (result.error) {
                    throw result.error;
                }
                
                return true;
            } catch (error) {
                console.error('Errore eliminazione Supabase:', error);
                // Fallback to localStorage
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
        showNotification('success', 'Dati sincronizzati con successo!');
    }
}

// Inizializza il database manager
const dbManager = new DatabaseManager();

// Sistema di notifiche migliorato
function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Aggiungi stili se non esistono
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 300px;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideInRight 0.3s ease;
            }
            .notification.success { background: #d4edda; color: #155724; border-left: 4px solid #28a745; }
            .notification.error { background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
            .notification.info { background: #d1ecf1; color: #0c5460; border-left: 4px solid #17a2b8; }
            .notification.warning { background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; }
            .notification-content { display: flex; align-items: center; gap: 10px; }
            .notification-close { background: none; border: none; font-size: 18px; cursor: pointer; margin-left: auto; }
            @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Rimuovi automaticamente dopo 5 secondi
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    return icons[type] || 'ℹ️';
}

// Funzioni per le fatture
async function caricaFornitori() {
    try {
        const fornitori = await dbManager.loadData('fornitori');
        const fornitoreSelect = document.getElementById('fornitore');
        const filtroFornitore = document.getElementById('filtroFornitore');
        
        if (fornitoreSelect) {
            fornitoreSelect.innerHTML = '<option value="">Seleziona fornitore...</option>';
            fornitori.forEach(f => {
                fornitoreSelect.innerHTML += `<option value="${f.nome}">${f.nome}</option>`;
            });
        }
        
        if (filtroFornitore) {
            filtroFornitore.innerHTML = '<option value="">Tutti i fornitori</option>';
            fornitori.forEach(f => {
                filtroFornitore.innerHTML += `<option value="${f.nome}">${f.nome}</option>`;
            });
        }
        
        const fornitoriList = document.getElementById('fornitoriList');
        if (fornitoriList) {
            fornitoriList.innerHTML = fornitori.map(f => `
                <div class="fornitore-tag">
                    ${f.nome}
                    <button class="remove-btn" onclick="rimuoviFornitore('${f.id}')">×</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Errore caricamento fornitori:', error);
        showNotification('error', 'Errore nel caricamento dei fornitori');
    }
}

async function aggiungiFornitore() {
    const nome = document.getElementById('nuovoFornitore')?.value.trim();
    if (!nome) return;
    
    try {
        const nuovoFornitore = {
            nome: nome,
            created_at: new Date().toISOString()
        };
        
        await dbManager.saveData('fornitori', nuovoFornitore);
        document.getElementById('nuovoFornitore').value = '';
        await caricaFornitori();
        showNotification('success', 'Fornitore aggiunto con successo!');
    } catch (error) {
        console.error('Errore aggiunta fornitore:', error);
        showNotification('error', 'Errore nell\'aggiunta del fornitore');
    }
}

async function rimuoviFornitore(id) {
    try {
        await dbManager.deleteData('fornitori', id);
        await caricaFornitori();
        showNotification('success', 'Fornitore rimosso con successo!');
    } catch (error) {
        console.error('Errore rimozione fornitore:', error);
        showNotification('error', 'Errore nella rimozione del fornitore');
    }
}

async function salvaFattura(e) {
    e.preventDefault();
    
    const formData = {
        fornitore: document.getElementById('fornitore').value,
        importo: parseFloat(document.getElementById('importo').value),
        descrizione: document.getElementById('descrizione').value,
        data: document.getElementById('dataFattura').value,
        scadenza: document.getElementById('scadenza').value,
        modalitaPagamento: document.getElementById('modalitaPagamento').value,
        stato: document.getElementById('stato').value,
        created_at: new Date().toISOString()
    };
    
    try {
        await dbManager.saveData('fatture', formData);
        document.getElementById('fatturaForm').reset();
        await mostraFatture();
        showNotification('success', 'Fattura salvata con successo!');
    } catch (error) {
        console.error('Errore salvataggio fattura:', error);
        showNotification('error', 'Errore nel salvataggio della fattura');
    }
}

async function mostraFatture() {
    try {
        const fatture = await dbManager.loadData('fatture');
        const container = document.getElementById('fattureList');
        
        if (!container) return;
        
        // Applica filtri
        const filtroStato = document.getElementById('filtroStato')?.value || '';
        const filtroFornitore = document.getElementById('filtroFornitore')?.value || '';
        const filtroRicerca = document.getElementById('filtroRicerca')?.value.toLowerCase() || '';
        
        let fattureFiltrate = fatture.filter(f => {
            const matchStato = !filtroStato || f.stato === filtroStato;
            const matchFornitore = !filtroFornitore || f.fornitore === filtroFornitore;
            const matchRicerca = !filtroRicerca || f.descrizione.toLowerCase().includes(filtroRicerca);
            return matchStato && matchFornitore && matchRicerca;
        });
        
        if (fattureFiltrate.length === 0) {
            container.innerHTML = '<div class="empty-state">Nessuna fattura trovata</div>';
            return;
        }
        
        container.innerHTML = fattureFiltrate.map(fattura => {
            const isScaduta = fattura.stato === 'da pagare' && new Date(fattura.scadenza) < new Date();
            const statusClass = isScaduta ? 'scaduta' : fattura.stato.replace(' ', '-');
            
            return `
                <div class="fattura-card ${statusClass}">
                    <div class="fattura-header">
                        <div class="fattura-fornitore">${fattura.fornitore}</div>
                        <div class="fattura-importo">€${fattura.importo.toFixed(2)}</div>
                    </div>
                    <div class="fattura-status ${statusClass}">${isScaduta ? 'SCADUTA' : fattura.stato.toUpperCase()}</div>
                    <div class="fattura-details">
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Descrizione</div>
                            <div class="fattura-detail-value">${fattura.descrizione}</div>
                        </div>
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Data Fattura</div>
                            <div class="fattura-detail-value">${new Date(fattura.data).toLocaleDateString('it-IT')}</div>
                        </div>
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Scadenza</div>
                            <div class="fattura-detail-value">${new Date(fattura.scadenza).toLocaleDateString('it-IT')}</div>
                        </div>
                        <div class="fattura-detail">
                            <div class="fattura-detail-label">Pagamento</div>
                            <div class="fattura-detail-value">${fattura.modalitaPagamento}</div>
                        </div>
                    </div>
                    <div class="fattura-actions">
                        <button class="btn-edit" onclick="modificaFattura('${fattura.id}')">✏️ Modifica</button>
                        <button class="btn-delete" onclick="eliminaFattura('${fattura.id}')">🗑️ Elimina</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Errore visualizzazione fatture:', error);
        showNotification('error', 'Errore nel caricamento delle fatture');
    }
}

async function eliminaFattura(id) {
    if (!confirm('Sei sicuro di voler eliminare questa fattura?')) return;
    
    try {
        await dbManager.deleteData('fatture', id);
        await mostraFatture();
        showNotification('success', 'Fattura eliminata con successo!');
    } catch (error) {
        console.error('Errore eliminazione fattura:', error);
        showNotification('error', 'Errore nell\'eliminazione della fattura');
    }
}

function modificaFattura(id) {
    showNotification('info', 'Funzione modifica in sviluppo!');
}

function resetFatturaForm() {
    document.getElementById('fatturaForm').reset();
}

// Funzioni per le ricorrenze
async function salvaRicorrenza(e) {
    e.preventDefault();
    
    const formData = {
        tipo: document.getElementById('tipoRicorrenza').value,
        nome: document.getElementById('nomeRicorrenza').value,
        importo: parseFloat(document.getElementById('importoRicorrenza').value),
        frequenza: document.getElementById('frequenzaRicorrenza').value,
        created_at: new Date().toISOString()
    };
    
    try {
        await dbManager.saveData('ricorrenze', formData);
        document.getElementById('ricorrenzaForm').reset();
        await mostraRicorrenze();
        showNotification('success', 'Ricorrenza salvata con successo!');
    } catch (error) {
        console.error('Errore salvataggio ricorrenza:', error);
        showNotification('error', 'Errore nel salvataggio della ricorrenza');
    }
}

async function mostraRicorrenze() {
    try {
        const ricorrenze = await dbManager.loadData('ricorrenze');
        const container = document.getElementById('ricorrenzeList');
        
        if (!container) return;
        
        if (ricorrenze.length === 0) {
            container.innerHTML = '<div class="empty-state">Nessuna ricorrenza configurata</div>';
            return;
        }
        
        container.innerHTML = ricorrenze.map(r => `
            <div class="ricorrenza-item">
                <b>${r.nome}</b> - ${r.tipo === 'entrata' ? '💰' : '📤'} €${r.importo.toFixed(2)} 
                (${r.frequenza})
                <button class="btn-delete" onclick="eliminaRicorrenza('${r.id}')" style="float: right; margin-left: 10px;">🗑️</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Errore visualizzazione ricorrenze:', error);
        showNotification('error', 'Errore nel caricamento delle ricorrenze');
    }
}

async function eliminaRicorrenza(id) {
    if (!confirm('Sei sicuro di voler eliminare questa ricorrenza?')) return;
    
    try {
        await dbManager.deleteData('ricorrenze', id);
        await mostraRicorrenze();
        showNotification('success', 'Ricorrenza eliminata con successo!');
    } catch (error) {
        console.error('Errore eliminazione ricorrenza:', error);
        showNotification('error', 'Errore nell\'eliminazione della ricorrenza');
    }
}

// Modifica delle funzioni di raccolta dati per il dashboard
async function raccogliDatiFinanziari(start, end) {
    try {
        // Carica chiusure cassa
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusureFiltrate = chiusure.filter(c => {
            const d = new Date(c.data);
            return d >= start && d <= end;
        });

        // Carica fatture
        const fatture = await dbManager.loadData('fatture');
        const fattureFiltrate = fatture.filter(f => {
            const d = new Date(f.data);
            return d >= start && d <= end;
        });

        // Carica ricorrenze
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
        return {
            chiusure: [],
            fatture: [],
            ricorrenze: [],
            ricaviCassa: 0,
            entrateRicorrenti: 0,
            usciteRicorrenti: 0,
            fatturepagate: 0,
            fatturePendenti: 0,
            fattureScadute: 0,
            totaleEntrate: 0,
            totaleUscite: 0,
            utileNetto: 0,
            ivaVendite: 0,
            ivaAcquisti: 0,
            ivaNettaDaVersare: 0,
            start,
            end
        };
    }
}

// Resto del codice JavaScript originale
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
    
    const optionsDate = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    dateEl.textContent = now.toLocaleDateString('it-IT', optionsDate);
    
    const optionsTime = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
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
    
    // Calcola dati per ogni mese
    for (let mese = 0; mese < 12; mese++) {
        const inizioMese = new Date(year, mese, 1);
        const fineMese = new Date(year, mese + 1, 0);
        raccogliDatiFinanziari(inizioMese, fineMese).then(datiMese => {
            entratePerMese[mese] = datiMese.totaleEntrate;
            uscitePerMese[mese] = datiMese.totaleUscite;
        });
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
                legend: {
                    position: 'top'
                }
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
                legend: {
                    position: 'bottom'
                }
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
                legend: {
                    display: false
                }
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
        raccogliDatiFinanziari(inizioMese, fineMese).then(datiMese => {
            ivaData.push(datiMese.ivaNettaDaVersare);
        });
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
                legend: {
                    display: false
                }
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
    
    container.innerHTML = alerts.length > 0 ? alerts.map(alert => `
        <div class="alert ${alert.type}">
            <span class="alert-icon">${alert.icon}</span>
            <span class="alert-message">${alert.message}</span>
        </div>
    `).join('') : '<div class="empty-state">Nessun alert al momento</div>';
}

// Classe per il calendario delle chiusure
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
        const modal = document.getElementById('messageModal');
        const closeBtn = modal?.querySelector('.close');
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        if (modal) {
            window.onclick = (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            };
        }
    }

    render() {
        this.updateMonthDisplay();
        this.generateCalendar();
    }

    updateMonthDisplay() {
        const monthEl = document.getElementById('calendarMonth');
        if (monthEl) {
            monthEl.textContent = this.currentDate.toLocaleDateString('it-IT', {
                month: 'long',
                year: 'numeric'
            });
        }
    }

    async generateCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '';
        
        // Headers
        const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        dayHeaders.forEach(day => {
            html += `<div class="calendar-header">${day}</div>`;
        });

        // Carica i dati delle chiusure per il mese
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusureMap = {};
        chiusure.forEach(c => {
            chiusureMap[c.data] = c;
        });

        // Days
        const today = new Date();
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dateKey = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === today.toDateString();
            const hasData = chiusureMap[dateKey];
            
            let classes = ['calendar-day'];
            if (!isCurrentMonth) classes.push('other-month');
            if (isToday) classes.push('today');
            if (hasData) classes.push('has-data');
            
            html += `<div class="${classes.join(' ')}" data-date="${dateKey}" onclick="window.calendarChiusure.selectDate('${dateKey}')">
                ${date.getDate()}
            </div>`;
        }

        grid.innerHTML = html;
    }

    async selectDate(dateKey) {
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusura = chiusure.find(c => c.data === dateKey);
        
        if (chiusura) {
            this.showDetails(chiusura);
        } else {
            this.showMessage(`Nessuna chiusura registrata per il ${new Date(dateKey).toLocaleDateString('it-IT')}`);
        }
    }

    showDetails(chiusura) {
        const detailsEl = document.getElementById('calendarDetails');
        const contentEl = document.getElementById('detailsContent');
        
        if (detailsEl && contentEl) {
            const content = `
Data: ${new Date(chiusura.data).toLocaleDateString('it-IT')}
Scontrinato Totale: €${(chiusura.scontrinatoTotale || 0).toFixed(2)}
Scontrinato Contanti: €${(chiusura.scontrinatoContanti || 0).toFixed(2)}
Scontrinato POS: €${(chiusura.scontrinatoPos || 0).toFixed(2)}
Art. 74: €${(chiusura.art74 || 0).toFixed(2)}
Art. 22: €${(chiusura.art22 || 0).toFixed(2)}
Drop POS: €${(chiusura.dropPos || 0).toFixed(2)}
Drop Cash: €${(chiusura.dropCash || 0).toFixed(2)}
Fondo Cassa: €${(chiusura.fondoCassa || 0).toFixed(2)}
            `;
            
            contentEl.textContent = content;
            detailsEl.style.display = 'block';
        }
    }

    showMessage(message) {
        const modal = document.getElementById('messageModal');
        const modalBody = document.getElementById('modalBody');
        
        if (modal && modalBody) {
            modalBody.innerHTML = `<p>${message}</p>`;
            modal.style.display = 'block';
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

    printDetails() {
        const content = document.getElementById('detailsContent')?.textContent;
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
        const content = document.getElementById('detailsContent')?.textContent;
        if (content) {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chiusura_${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
}

// Classe per il calendario nella sezione chiusura cassa
class CassaCalendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.init();
    }

    init() {
        this.render();
    }

    render() {
        this.updateMonthDisplay();
        this.generateCalendar();
    }

    updateMonthDisplay() {
        const monthEl = document.getElementById('cassaCalendarMonth');
        if (monthEl) {
            monthEl.textContent = this.currentDate.toLocaleDateString('it-IT', {
                month: 'long',
                year: 'numeric'
            });
        }
    }

    async generateCalendar() {
        const grid = document.getElementById('cassaCalendarGrid');
        if (!grid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '';
        
        // Headers
        const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        dayHeaders.forEach(day => {
            html += `<div class="cassa-calendar-header">${day}</div>`;
        });

        // Carica i dati delle chiusure per il mese
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusureMap = {};
        chiusure.forEach(c => {
            chiusureMap[c.data] = c;
        });

        // Days
        const today = new Date();
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dateKey = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === today.toDateString();
            const hasData = chiusureMap[dateKey];
            
            let classes = ['cassa-calendar-day'];
            if (!isCurrentMonth) classes.push('other-month');
            if (isToday) classes.push('today');
            if (hasData) classes.push('has-data');
            if (this.selectedDate === dateKey) classes.push('selected');
            
            html += `<div class="${classes.join(' ')}" data-date="${dateKey}" onclick="window.cassaCalendar.selectDate('${dateKey}')">
                ${date.getDate()}
            </div>`;
        }

        grid.innerHTML = html;
    }

    async selectDate(dateKey) {
        this.selectedDate = dateKey;
        this.generateCalendar();
        
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const chiusura = chiusure.find(c => c.data === dateKey);
        
        const infoEl = document.getElementById('selectedDateInfo');
        if (infoEl) {
            if (chiusura) {
                infoEl.innerHTML = `
                    <strong>${new Date(dateKey).toLocaleDateString('it-IT')}</strong><br>
                    Scontrinato: €${(chiusura.scontrinatoTotale || 0).toFixed(2)}<br>
                    Fondo Cassa: €${(chiusura.fondoCassa || 0).toFixed(2)}
                `;
            } else {
                infoEl.innerHTML = `
                    <strong>${new Date(dateKey).toLocaleDateString('it-IT')}</strong><br>
                    Nessuna chiusura registrata
                `;
            }
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
}

// Sistema di chiusura cassa
class ChiusuraCassaSystem {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTodayData();
    }

    bindEvents() {
        // Bind input events for real-time calculation
        const inputs = [
            'scontrinatoTotale', 'scontrinatoContanti', 'scontrinatoPos',
            'art74', 'art22', 'dropPos', 'dropCash',
            'moneteGiornoPrecedente', 'moneteAttuali'
        ];

        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.calcolaAutomatico());
            }
        });
    }

    async loadTodayData() {
        const today = new Date().toISOString().split('T')[0];
        const chiusure = await dbManager.loadData('chiusure_cassa');
        const todayData = chiusure.find(c => c.data === today);
        
        if (todayData) {
            this.loadDataIntoForm(todayData);
        }
    }

    loadDataIntoForm(data) {
        const fields = [
            'scontrinatoTotale', 'scontrinatoContanti', 'scontrinatoPos',
            'art74', 'art22', 'dropPos', 'dropCash',
            'moneteGiornoPrecedente', 'moneteAttuali'
        ];

        fields.forEach(field => {
            const input = document.getElementById(field);
            if (input && data[field] !== undefined) {
                input.value = data[field];
            }
        });

        this.calcolaAutomatico();
    }

    calcolaAutomatico() {
        const values = this.getFormValues();
        
        // Calcola totale contanti in cassa
        const totaleContanti = values.scontrinatoContanti + values.art74 + values.art22;
        const totaleContantiEl = document.getElementById('totaleContantiCassa');
        if (totaleContantiEl) {
            totaleContantiEl.textContent = `€${totaleContanti.toFixed(2)}`;
        }

        // Calcola fondo cassa
        const differenzaMonete = values.moneteAttuali - values.moneteGiornoPrecedente;
        const fondoCassa = totaleContanti - values.scontrinatoContanti - values.dropCash + differenzaMonete - 100;
        
        const fondoCassaEl = document.getElementById('fondoCassaResult');
        const interpretationEl = document.getElementById('fondoCassaInterpretation');
        
        if (fondoCassaEl) {
            fondoCassaEl.textContent = `€${fondoCassa.toFixed(2)}`;
        }

        if (interpretationEl) {
            if (Math.abs(fondoCassa) <= 5) {
                interpretationEl.textContent = '✅ Perfetto! Quadratura esatta.';
                interpretationEl.className = 'result-interpretation perfect';
            } else if (Math.abs(fondoCassa) <= 20) {
                interpretationEl.textContent = '⚠️ Differenza accettabile.';
                interpretationEl.className = 'result-interpretation warning';
            } else {
                interpretationEl.textContent = '❌ Differenza significativa da verificare.';
                interpretationEl.className = 'result-interpretation danger';
            }
        }
    }

    getFormValues() {
        return {
            scontrinatoTotale: parseFloat(document.getElementById('scontrinatoTotale')?.value) || 0,
            scontrinatoContanti: parseFloat(document.getElementById('scontrinatoContanti')?.value) || 0,
            scontrinatoPos: parseFloat(document.getElementById('scontrinatoPos')?.value) || 0,
            art74: parseFloat(document.getElementById('art74')?.value) || 0,
            art22: parseFloat(document.getElementById('art22')?.value) || 0,
            dropPos: parseFloat(document.getElementById('dropPos')?.value) || 0,
            dropCash: parseFloat(document.getElementById('dropCash')?.value) || 0,
            moneteGiornoPrecedente: parseFloat(document.getElementById('moneteGiornoPrecedente')?.value) || 0,
            moneteAttuali: parseFloat(document.getElementById('moneteAttuali')?.value) || 0
        };
    }

    verificaCompleta() {
        const values = this.getFormValues();
        
        // Verifica coerenza scontrinato
        const sommaMetodi = values.scontrinatoContanti + values.scontrinatoPos;
        const differenzaScontrinato = Math.abs(values.scontrinatoTotale - sommaMetodi);
        
        const verificationEl = document.getElementById('verificationResult');
        if (verificationEl) {
            if (differenzaScontrinato <= 0.01) {
                verificationEl.textContent = '✅ Scontrinato verificato: la somma dei metodi di pagamento corrisponde al totale.';
                verificationEl.className = 'verification-result success';
            } else {
                verificationEl.textContent = `❌ Errore scontrinato: differenza di €${differenzaScontrinato.toFixed(2)} tra totale e somma metodi.`;
                verificationEl.className = 'verification-result error';
            }
        }

        // Verifica articoli
        const articoliEl = document.getElementById('articoliVerification');
        if (articoliEl) {
            if (values.art74 > 0 || values.art22 > 0) {
                articoliEl.textContent = `ℹ️ Articoli registrati: Art.74 €${values.art74.toFixed(2)}, Art.22 €${values.art22.toFixed(2)}`;
                articoliEl.className = 'articoli-verification success';
            } else {
                articoliEl.textContent = '⚠️ Nessun articolo 74 o 22 registrato.';
                articoliEl.className = 'articoli-verification error';
            }
        }

        this.calcolaAutomatico();
    }

    async salvaChiusura() {
        const values = this.getFormValues();
        const today = new Date().toISOString().split('T')[0];
        
        // Calcola fondo cassa
        const totaleContanti = values.scontrinatoContanti + values.art74 + values.art22;
        const differenzaMonete = values.moneteAttuali - values.moneteGiornoPrecedente;
        const fondoCassa = totaleContanti - values.scontrinatoContanti - values.dropCash + differenzaMonete - 100;

        const chiusuraData = {
            ...values,
            data: today,
            fondoCassa: fondoCassa,
            timestamp: new Date().toISOString()
        };

        try {
            // Verifica se esiste già una chiusura per oggi
            const chiusure = await dbManager.loadData('chiusure_cassa');
            const existingChiusura = chiusure.find(c => c.data === today);
            
            if (existingChiusura) {
                // Aggiorna chiusura esistente
                await dbManager.saveData('chiusure_cassa', chiusuraData, existingChiusura.id);
                showNotification('success', 'Chiusura aggiornata con successo!');
            } else {
                // Crea nuova chiusura
                await dbManager.saveData('chiusure_cassa', chiusuraData);
                showNotification('success', 'Chiusura salvata con successo!');
            }

            // Aggiorna il calendario
            if (window.cassaCalendar) {
                window.cassaCalendar.render();
            }
        } catch (error) {
            console.error('Errore salvataggio chiusura:', error);
            showNotification('error', 'Errore nel salvataggio della chiusura');
        }
    }

    esportaReport() {
        const values = this.getFormValues();
        const today = new Date().toISOString().split('T')[0];
        
        const report = `
REPORT CHIUSURA CASSA - ${new Date().toLocaleDateString('it-IT')}
================================================================

SCONTRINATO:
- Totale: €${values.scontrinatoTotale.toFixed(2)}
- Contanti: €${values.scontrinatoContanti.toFixed(2)}
- POS: €${values.scontrinatoPos.toFixed(2)}

ARTICOLI:
- Art. 74: €${values.art74.toFixed(2)}
- Art. 22: €${values.art22.toFixed(2)}

DROP:
- POS: €${values.dropPos.toFixed(2)}
- Cash: €${values.dropCash.toFixed(2)}

MONETE:
- Giorno precedente: €${values.moneteGiornoPrecedente.toFixed(2)}
- Attuali: €${values.moneteAttuali.toFixed(2)}
- Differenza: €${(values.moneteAttuali - values.moneteGiornoPrecedente).toFixed(2)}

RISULTATI:
- Totale contanti in cassa: €${(values.scontrinatoContanti + values.art74 + values.art22).toFixed(2)}
- Fondo cassa: €${(values.scontrinatoContanti + values.art74 + values.art22 - values.scontrinatoContanti - values.dropCash + (values.moneteAttuali - values.moneteGiornoPrecedente) - 100).toFixed(2)}

Generato il: ${new Date().toLocaleString('it-IT')}
        `;

        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chiusura_cassa_${today}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('success', 'Report esportato con successo!');
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
