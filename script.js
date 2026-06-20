// ============ CONFIGURACIÓN ============
const SPREADSHEET_ID = '18M9CQc65PNk5cLv1GsxK6bRbttTgYCN0gflgGdLxTUQ';
const API_KEY = 'AIzaSyBlfWa3Y7OufGi9zm91ax4CTkbjRqs72pw';
const SHEET_NAME = 'Hoja%201';

// ============ VARIABLES GLOBALES ============
let allData = [];
let currentPage = 0;
const PAGE_SIZE = 50;
let isLoading = false;
let hasMore = true;
let filteredData = [];

// ============ CARGAR DATOS ============
async function loadData() {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '<p style="text-align:center;">🔄 Cargando datos...</p>';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
        console.log('📡 URL:', url);
        
        const response = await fetch(url);
        console.log('📡 Status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error:', errorText);
            
            let mensaje = `❌ Error ${response.status}`;
            if (response.status === 403) {
                mensaje = `
                    ❌ Error 403: Permiso denegado<br><br>
                    <strong>📌 Solución:</strong><br>
                    1. Abre tu Google Sheets "Diseños Punto"<br>
                    2. Haz clic en "Compartir"<br>
                    3. Añade este email como editor:<br>
                    <code style="background:#f0f0f0;padding:4px 8px;border-radius:4px;display:inline-block;margin:8px 0;">
                        disenos-punto@disenospunto.iam.gserviceaccount.com
                    </code><br>
                    4. Acepta y recarga esta página
                `;
            }
            
            gallery.innerHTML = `<p style="text-align:center;color:red;">${mensaje}</p>`;
            return;
        }
        
        const data = await response.json();
        console.log('📊 Datos recibidos:', data);
        
        if (!data.values || data.values.length === 0) {
            gallery.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">✅ No hay datos en la hoja</p>';
            return;
        }
        
        const headers = data.values[0];
        console.log('📋 Encabezados:', headers);
        
        allData = data.values.slice(1)
            .filter(row => row.length > 1 && row[0] && row[1])
            .map(row => {
                const obj = {};
                headers.forEach((header, i) => {
                    obj[header] = row[i] || '';
                });
                return obj;
            });
        
        console.log(`📊 Cargados ${allData.length} diseños`);
        
        populateFilters();
        applyFilters();
        
    } catch (error) {
        console.error('❌ Error:', error);
        gallery.innerHTML = `
            <p style="text-align:center;color:red;">
                ❌ Error: ${error.message}<br>
                <small>Revisa la consola (F12)</small>
            </p>
        `;
    }
}

// ============ POPULAR FILTROS ============
function populateFilters() {
    const tipos = new Set();
    const disenadoras = new Set();
    const etiquetas = new Set();
    
    allData.forEach(item => {
        const tipo = item.tipo_real || item.tipo_adivinado || 'otro';
        tipos.add(tipo);
        if (item.diseñadora) disenadoras.add(item.diseñadora);
        if (item.etiquetas) {
            item.etiquetas.split(',').forEach(e => {
                const tag = e.trim();
                if (tag) etiquetas.add(tag);
            });
        }
    });
    
    const tipoSelect = document.getElementById('tipoFilter');
    [...tipos].sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tipoSelect.appendChild(opt);
    });
    
    const disenadoraSelect = document.getElementById('disenadoraFilter');
    [...disenadoras].sort().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        disenadoraSelect.appendChild(opt);
    });
    
    const etiquetaSelect = document.getElementById('etiquetaFilter');
    [...etiquetas].sort().forEach(e => {
        const opt = document.createElement('option');
        opt.value = e;
        opt.textContent = e;
        etiquetaSelect.appendChild(opt);
    });
}

// ============ FILTRAR ============
function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const tipo = document.getElementById('tipoFilter').value;
    const disenadora = document.getElementById('disenadoraFilter').value;
    const etiqueta = document.getElementById('etiquetaFilter').value;
    
    filteredData = allData.filter(item => {
        if (search) {
            const searchable = [
                item.diseñadora,
                item.nombre_archivo,
                item.tipo_real,
                item.tipo_adivinado,
                item.etiquetas,
                item.observaciones
            ].join(' ').toLowerCase();
            if (!searchable.includes(search)) return false;
        }
        if (tipo) {
            const itemTipo = item.tipo_real || item.tipo_adivinado || 'otro';
            if (itemTipo !== tipo) return false;
        }
        if (disenadora && item.diseñadora !== disenadora) return false;
        if (etiqueta) {
            if (!item.etiquetas || !item.etiquetas.includes(etiqueta)) return false;
        }
        return true;
    });
    
    filteredData.sort((a, b) => {
        if (a.diseñadora !== b.diseñadora) {
            return a.diseñadora.localeCompare(b.diseñadora);
        }
        return a.nombre_archivo.localeCompare(b.nombre_archivo);
    });
    
    document.getElementById('resultCount').textContent = `${filteredData.length} diseños encontrados`;
    
    currentPage = 0;
    hasMore = true;
    document.getElementById('gallery').innerHTML = '';
    
    if (filteredData.length === 0) {
        document.getElementById('gallery').innerHTML = 
            '<p style="text-align:center;color:var(--text-secondary);">No se encontraron diseños</p>';
        return;
    }
    
    loadMore();
}

// ============ SCROLL INFINITO ============
function loadMore() {
    if (isLoading || !hasMore || filteredData.length === 0) return;
    
    const start = currentPage * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filteredData.length);
    
    if (start >= filteredData.length) {
        hasMore = false;
        document.getElementById('loader').style.display = 'none';
        return;
    }
    
    isLoading = true;
    document.getElementById('loader').style.display = 'block';
    
    const batch = filteredData.slice(start, end);
    const gallery = document.getElementById('gallery');
    
    setTimeout(() => {
        batch.forEach(item => {
            const card = createCard(item);
            gallery.appendChild(card);
        });
        currentPage++;
        isLoading = false;
        document.getElementById('loader').style.display = 'none';
        if (end >= filteredData.length) {
            hasMore = false;
        }
    }, 50);
}

// ============ CREAR TARJETA ============
function createCard(item) {
    const div = document.createElement('div');
    div.className = 'card';
    
    const tipo = item.tipo_real || item.tipo_adivinado || 'Sin clasificar';
    const imagen = item.miniatura_url || '';
    const etiquetas = item.etiquetas ? item.etiquetas.split(',').map(e => e.trim()).filter(e => e) : [];
    
    div.innerHTML = `
        <img src="${imagen || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'250\' viewBox=\'0 0 400 250\'%3E%3Crect width=\'400\' height=\'250\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'200\' y=\'120\' text-anchor=\'middle\' fill=\'%23999\' font-family=\'sans-serif\' font-size=\'16\'%3ESin miniatura%3C/text%3E%3C/svg%3E'}" 
             alt="${item.nombre_archivo}" 
             loading="lazy"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'250\' viewBox=\'0 0 400 250\'%3E%3Crect width=\'400\' height=\'250\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'200\' y=\'120\' text-anchor=\'middle\' fill=\'%23999\' font-family=\'sans-serif\' font-size=\'16\'%3EImagen no disponible%3C/text%3E%3C/svg%3E'">
        <div class="card-info">
            <h3>${item.nombre_archivo ? item.nombre_archivo.replace('.pdf', '') : 'Sin nombre'}</h3>
            <div class="disenadora">✏️ ${item.diseñadora || 'Sin diseñadora'}</div>
            <span class="tipo">${tipo}</span>
            ${etiquetas.length > 0 ? `
                <div class="etiquetas">
                    ${etiquetas.map(e => `<span class="etiqueta">${e}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    div.addEventListener('click', () => openModal(item));
    return div;
}

// ============ MODAL ============
function openModal(item) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modalBody');
    
    const tipo = item.tipo_real || item.tipo_adivinado || 'Sin clasificar';
    const imagen = item.miniatura_url || '';
    
    body.innerHTML = `
        <div class="modal-grid">
            <div class="modal-image">
                <img src="${imagen || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\' viewBox=\'0 0 400 400\'%3E%3Crect width=\'400\' height=\'400\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'200\' y=\'200\' text-anchor=\'middle\' fill=\'%23999\' font-family=\'sans-serif\' font-size=\'16\'%3ESin imagen%3C/text%3E%3C/svg%3E'}" 
                     alt="${item.nombre_archivo}"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\' viewBox=\'0 0 400 400\'%3E%3Crect width=\'400\' height=\'400\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'200\' y=\'200\' text-anchor=\'middle\' fill=\'%23999\' font-family=\'sans-serif\' font-size=\'16\'%3EImagen no disponible%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="modal-details">
                <h2>${item.nombre_archivo ? item.nombre_archivo.replace('.pdf', '') : 'Sin nombre'}</h2>
                
                <div class="field">
                    <label>Diseñadora</label>
                    <p><strong>${item.diseñadora || 'Sin diseñadora'}</strong></p>
                </div>
                
                <div class="field">
                    <label>Tipo</label>
                    <p><strong>${tipo}</strong></p>
                </div>
                
                ${item.etiquetas ? `
                    <div class="field">
                        <label>Etiquetas</label>
                        <p>${item.etiquetas}</p>
                    </div>
                ` : ''}
                
                <div class="field">
                    <label>Observaciones</label>
                    <textarea id="modalObservaciones" placeholder="Añade tus observaciones aquí...">${item.observaciones || ''}</textarea>
                </div>
                
                <div class="modal-actions">
                    ${item.miniatura_url ? `<a href="${item.miniatura_url}" target="_blank" class="btn btn-secondary">🖼️ Ver imagen</a>` : ''}
                    <button onclick="guardarObservacion('${item.ruta_pdf}')" class="btn btn-primary">💾 Guardar observación</button>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// ============ GUARDAR OBSERVACIONES ============
function guardarObservacion(ruta_pdf) {
    const observaciones = document.getElementById('modalObservaciones').value;
    const btn = document.querySelector('.btn-primary');
    const originalText = btn.textContent;
    
    btn.textContent = '⏳ Guardando...';
    btn.disabled = true;
    
    const item = allData.find(i => i.ruta_pdf === ruta_pdf);
    if (item) {
        item.observaciones = observaciones;
    }
    
    setTimeout(() => {
        btn.textContent = '✅ ¡Guardado localmente!';
        btn.style.background = '#2ecc71';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
        }, 1500);
    }, 800);
}

// ============ EVENTOS ============
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('tipoFilter').addEventListener('change', applyFilters);
document.getElementById('disenadoraFilter').addEventListener('change', applyFilters);
document.getElementById('etiquetaFilter').addEventListener('change', applyFilters);

document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) {
        document.getElementById('modal').style.display = 'none';
    }
});

// ============ BOTÓN LIMPIAR FILTROS ============
// Usamos una función separada y la asignamos directamente
function limpiarFiltros() {
    console.log('🔄 Limpiando filtros...');
    document.getElementById('searchInput').value = '';
    document.getElementById('tipoFilter').value = '';
    document.getElementById('disenadoraFilter').value = '';
    document.getElementById('etiquetaFilter').value = '';
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log('✅ Filtros limpiados');
}

// Asignar el evento después de que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', limpiarFiltros);
        console.log('✅ Botón de limpiar vinculado');
    } else {
        console.error('❌ No se encontró el botón de limpiar');
    }
});

// También lo asignamos directamente por si el DOM ya está cargado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', limpiarFiltros);
    }
}

let scrollTimeout;
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            loadMore();
        }
    }, 100);
});

// ============ INICIAR ============
loadData();