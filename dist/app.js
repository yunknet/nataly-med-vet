'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const read = (k, d) => {
  try { return JSON.parse(localStorage.getItem('nm-' + k)) ?? d; }
  catch { return d; }
};
const write = (k, v) => {
  try { localStorage.setItem('nm-' + k, JSON.stringify(v)); }
  catch { toast('Não foi possível salvar os dados neste navegador.'); }
};

let data = null;
let view = 'inicio';
let prevView = '';
let query = '';
let group = '';
let species = '';
let route = '';
let section = '';
let page = 1;
let favs = read('favorites', []);
let done = read('done', []);
let notes = read('notes', {});
let recent = read('recent', []);
let currentRecord = null;

if (read('dark', false)) {
  document.body.classList.add('dark');
}

const titles = {
  inicio: 'Visão geral',
  biblioteca: 'Biblioteca clínica',
  medicamentos: 'Guia de medicamentos',
  estudos: 'Caderno clínico',
  favoritos: 'Favoritos',
  sobre: 'Sobre o sistema'
};

function toast(s) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = s;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2600);
}

function head(eyebrow, title, subtitle) {
  return `<div class="pagehead">
    <div>
      <div class="eyebrow">${eyebrow}</div>
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
  </div>`;
}

function searchBox(placeholder = 'Busque por diagnóstico, medicamento ou princípio ativo…') {
  return `<div class="searchbar">
    <div class="searchbox">
      <span class="search-icon">⌕</span>
      <input id="search" type="search" aria-label="Pesquisar na rotina clínica" placeholder="${placeholder}" value="${esc(query)}" autocomplete="off">
      ${query ? '<button type="button" class="search-clear" id="searchClear" aria-label="Limpar busca">✕</button>' : ''}
      <button type="button" class="btn search-btn" id="searchSubmit">Buscar</button>
    </div>
  </div>`;
}

function closeMobileMenu() {
  $('#sidebar')?.classList.remove('open');
  $('#sidebarBackdrop')?.classList.remove('open');
  document.body.classList.remove('menu-open');
}

function openMobileMenu() {
  $('#sidebar')?.classList.add('open');
  $('#sidebarBackdrop')?.classList.add('open');
  document.body.classList.add('menu-open');
}

function groups(doc = 'clinica') {
  if (!data?.records) return [];
  return [...new Set(data.records.filter(r => r.doc === doc).map(r => r.group))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function go(targetView, targetGroup = '', targetQuery = '') {
  query = targetQuery;
  group = targetGroup;
  species = '';
  route = '';
  section = '';
  page = 1;
  closeMobileMenu();
  if (location.hash === '#' + targetView) {
    render();
  } else {
    location.hash = targetView;
  }
}

function card(r) {
  const isFav = favs.includes(r.id);
  const isDone = done.includes(r.id);
  return `<article class="record">
    <button type="button" class="favorite" data-fav="${r.id}" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" title="${isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}">${isFav ? '♥' : '♡'}</button>
    <span class="tag">${esc(r.group)}</span>
    <h3>${esc(r.title)}</h3>
    <p>${esc(r.summary)}</p>
    <div class="meta">
      <span>${esc(r.species || 'Cães e Gatos')}</span>
      ${r.route ? `<span> · ${esc(r.route)}</span>` : ''}
      ${isDone ? '<span class="badge-done">✓ Conduta revisada</span>' : ''}
    </div>
    <button type="button" class="btn card-btn" data-open="${r.id}">Consultar conduta <span>↗</span></button>
  </article>`;
}

function bindCards() {
  document.querySelectorAll('[data-open]').forEach(el => {
    el.onclick = () => openRecord(el.dataset.open);
  });
  document.querySelectorAll('[data-fav]').forEach(el => {
    el.onclick = e => {
      e.stopPropagation();
      const id = el.dataset.fav;
      favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
      write('favorites', favs);
      el.textContent = favs.includes(id) ? '♥' : '♡';
      el.setAttribute('aria-label', favs.includes(id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      if (view === 'favoritos') renderResults();
    };
  });
  document.querySelectorAll('[data-group]').forEach(el => {
    el.onclick = () => go('biblioteca', el.dataset.group);
  });
}

function home() {
  const clinical = data.records.filter(r => r.doc === 'clinica');
  const meds = data.records.filter(r => r.doc === 'posologia');
  const gs = groups('clinica');

  return head('ROTINA DE ATENDIMENTO', 'Mais agilidade para a conduta clínica.', 'Seu guia rápido de diagnóstico, posologia e conduta terapêutica em pequenos animais.') +
  `<section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">CONSULTA RÁPIDA · PLANTÃO E ATENDIMENTO</div>
      <h2>Uma boa conduta começa<br>com boas referências.</h2>
      <p>Acesse rapidamente protocolos clínicos hospitalares, prescrições domiciliares, exames recomendados e bulário com posologia em mg/kg.</p>
      <div class="hero-actions">
        <a class="btn" href="#biblioteca">Biblioteca clínica <span>↗</span></a>
        <a class="btn secondary" href="#medicamentos">Guia de medicamentos <span>↗</span></a>
      </div>
    </div>
    <img class="hero-photo" src="assets/nataly.webp" alt="Dra. Nataly Michel, médica veterinária">
    <span class="hero-signature">Dra. Nataly Michel · Médica veterinária</span>
  </section>

  <div class="stats">
    <div class="stat"><span class="stat-symbol">♡</span><div><strong>${clinical.length}</strong><small>Condições clínicas</small></div></div>
    <div class="stat"><span class="stat-symbol">✚</span><div><strong>${meds.length}</strong><small>Medicamentos catalogados</small></div></div>
    <div class="stat"><span class="stat-symbol">⌘</span><div><strong>${gs.length}</strong><small>Especialidades</small></div></div>
    <div class="stat"><span class="stat-symbol">▤</span><div><strong>${data.records.length}</strong><small>Fichas disponíveis</small></div></div>
  </div>

  ${searchBox('Busque por diagnóstico, medicamento ou princípio ativo…')}

  <div class="sectionhead">
    <div>
      <h2>Especialidades Clínicas</h2>
      <p>Acesse diretamente os protocolos clínicos de cada especialidade.</p>
    </div>
    <a class="textlink" href="#biblioteca">Ver todas as fichas ↗</a>
  </div>
  <div class="specialties">
    ${gs.map((g, i) => `
      <button type="button" class="specialty" data-group="${g}">
        <span class="glyph">${['♡', '◌', '≋', '◒', '✧', '♧', '✚', '⌘', '◈', '◷', '▤', '✦', '❋', '✿', '★', '✪', '❂'][i % 17]}</span>
        <b>${g}</b>
        <small>${clinical.filter(r => r.group === g).length} condutas <span>↗</span></small>
      </button>
    `).join('')}
  </div>

  <div class="sectionhead">
    <h2>${recent.length ? 'Consultados recentemente' : 'Condutas frequentes na rotina'}</h2>
    <a href="#estudos" class="textlink">Caderno clínico ↗</a>
  </div>
  <div class="records">
    ${(recent.length
      ? recent.map(id => data.records.find(r => r.id === id)).filter(Boolean)
      : clinical.filter(r => /doença renal crônica|dermatite atópica canina|diabetes mellitus/i.test(r.title))
    ).slice(0, 3).map(card).join('')}
  </div>

  <div class="notice">
    <strong>Aviso profissional:</strong> Conteúdo técnico de apoio à rotina e tomada de decisão clínica em pequenos animais. As recomendações, posologias e exames devem ser avaliados com base no quadro de cada paciente.
  </div>`;
}

function select(id, label, items, val) {
  return `<select id="${id}" aria-label="${label}">
    <option value="">${label}</option>
    ${items.map(x => {
      const v = typeof x === 'object' ? x.value : x;
      const t = typeof x === 'object' ? x.text : x;
      return `<option ${v === val ? 'selected' : ''} value="${esc(v)}">${esc(t)}</option>`;
    }).join('')}
  </select>`;
}

function library() {
  const isMed = view === 'medicamentos';
  const isFav = view === 'favoritos';

  let subtitle = 'Condutas, exames diagnósticos, prescrições hospitalares e domiciliares.';
  if (isMed) subtitle = 'Bulário posológico: princípio ativo, apresentações comerciais, doses em mg/kg e vias.';
  if (isFav) subtitle = 'Seus protocolos e medicamentos salvos para acesso imediato no atendimento.';

  const groupOptions = isFav
    ? [...new Set(data.records.map(r => r.group))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    : groups(isMed ? 'posologia' : 'clinica');

  const speciesOptions = [
    { value: 'cães', text: 'Cães (caninos)' },
    { value: 'gatos', text: 'Gatos (felinos)' },
    { value: 'cães e gatos', text: 'Ambas (Cães e Gatos)' }
  ];

  const sectionOptions = [
    { value: 'PRESCRIÇÃO HOSPITALAR', text: 'Prescrição Hospitalar' },
    { value: 'PRESCRIÇÃO DOMICILIAR', text: 'Prescrição Domiciliar' },
    { value: 'Solicitações:', text: 'Solicitações de Exames' },
    { value: 'Recomendações:', text: 'Orientações e Recomendações' }
  ];

  return head('CONSULTA DE ROTINA', titles[view], subtitle) +
  searchBox(isMed ? 'Pesquise por nome comercial, princípio ativo ou indicação…' : 'Pesquise por diagnóstico, sintoma ou conduta clínica…') +
  `<div class="filters">
    ${select('group', 'Todas as ' + (isMed ? 'categorias' : 'especialidades'), groupOptions, group)}
    ${select('species', 'Todas as espécies', speciesOptions, species)}
    ${isMed
      ? select('route', 'Todas as vias', [...new Set(data.records.filter(r => r.doc === 'posologia').map(r => r.route))].filter(Boolean).sort(), route)
      : select('section', 'Todos os tipos de conduta', sectionOptions, section)
    }
    <button type="button" class="btn secondary" id="clear">Limpar filtros</button>
  </div>
  <div id="results"></div>`;
}

function filtered() {
  const isMed = view === 'medicamentos';
  const isFav = view === 'favoritos';
  const targetDoc = isMed ? 'posologia' : 'clinica';

  const queryTerms = norm(query).trim().split(/\s+/).filter(Boolean);

  return data.records.filter(r => {
    if (isFav && !favs.includes(r.id)) return false;
    if (!isFav && r.doc !== targetDoc) return false;
    if (group && r.group !== group) return false;

    if (species) {
      if (species === 'cães e gatos') {
        if (!r.species.toLowerCase().includes('cães e gatos')) return false;
      } else {
        if (!r.species.toLowerCase().includes(species.toLowerCase())) return false;
      }
    }

    if (route && r.route !== route) return false;
    if (section && !r.sections.includes(section)) return false;

    if (queryTerms.length > 0) {
      const searchHaystack = norm(
        (r.title || '') + ' ' +
        (r.group || '') + ' ' +
        (r.active || '') + ' ' +
        (r.species || '') + ' ' +
        (r.text || '')
      );
      if (!queryTerms.every(term => searchHaystack.includes(term))) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}

function checkOtherSectionMatches() {
  if (!query.trim()) return null;
  const isMed = view === 'medicamentos';
  const otherDoc = isMed ? 'clinica' : 'posologia';
  const otherName = isMed ? 'Biblioteca Clínica' : 'Guia de Medicamentos';
  const otherTarget = isMed ? 'biblioteca' : 'medicamentos';

  const queryTerms = norm(query).trim().split(/\s+/).filter(Boolean);
  const otherMatches = data.records.filter(r => {
    if (r.doc !== otherDoc) return false;
    const haystack = norm((r.title || '') + ' ' + (r.group || '') + ' ' + (r.active || '') + ' ' + (r.text || ''));
    return queryTerms.every(term => haystack.includes(term));
  });

  if (otherMatches.length > 0) {
    return { count: otherMatches.length, name: otherName, target: otherTarget };
  }
  return null;
}

function renderResults() {
  const rs = filtered();
  const pages = Math.max(1, Math.ceil(rs.length / 18));
  page = Math.min(page, pages);

  const startIdx = (page - 1) * 18;
  const pageRecords = rs.slice(startIdx, startIdx + 18);

  let html = `<div class="resultsbar">
    <span><strong>${rs.length}</strong> ${rs.length === 1 ? 'item encontrado' : 'itens encontrados'}${query ? ` para “${esc(query)}”` : ''}</span>
    <span>Página ${page} de ${pages}</span>
  </div>`;

  if (rs.length > 0) {
    html += `<div class="records">${pageRecords.map(card).join('')}</div>`;
    if (pages > 1) {
      html += `<div class="pagination">
        <button type="button" class="btn secondary" id="prev" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="page-indicator">${page} / ${pages}</span>
        <button type="button" class="btn secondary" id="next" ${page >= pages ? 'disabled' : ''}>Próxima →</button>
      </div>`;
    }
  } else {
    const otherMatch = checkOtherSectionMatches();
    html += `<div class="empty">
      <p>Nenhum resultado encontrado com os filtros atuais.</p>
      ${otherMatch ? `
        <div class="other-match-box">
          <p>Foram encontrados <strong>${otherMatch.count}</strong> registros correspondentes em <strong>${otherMatch.name}</strong>.</p>
          <button type="button" class="btn" id="goToOtherSearch">Buscar “${esc(query)}” no ${otherMatch.name} ↗</button>
        </div>
      ` : `
        <p class="muted">Tente palavras mais genéricas ou redefina os filtros.</p>
        <button type="button" class="btn secondary" id="emptyReset">Limpar busca e filtros</button>
      `}
    </div>`;
  }

  const resultsContainer = $('#results');
  if (resultsContainer) {
    resultsContainer.innerHTML = html;
  }

  $('#prev')?.addEventListener('click', () => {
    page--;
    renderResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#next')?.addEventListener('click', () => {
    page++;
    renderResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#goToOtherSearch')?.addEventListener('click', () => {
    const other = checkOtherSectionMatches();
    if (other) go(other.target, '', query);
  });
  $('#emptyReset')?.addEventListener('click', () => {
    query = '';
    group = '';
    species = '';
    route = '';
    section = '';
    page = 1;
    render();
  });

  bindCards();
}

function cleanPackageDashes(line) {
  const m = line.match(/^(\d+\.\s*)?(.*?)\s*[-–—]{4,}\s*(.*?)\.?$/);
  if (m) {
    const num = (m[1] || '').replace('.', '').trim();
    let nameAndLab = m[2].trim();
    let lab = '';
    const labMatch = nameAndLab.match(/^(.*?)\s*\((.*?)\)$/);
    let name = nameAndLab;
    if (labMatch) {
      name = labMatch[1].trim();
      lab = labMatch[2].trim();
    }
    const pkg = m[3].trim().replace(/\.+$/, '');
    return { isRxHeader: true, num, name, lab, pkg };
  }
  return null;
}

function formatPosologiaRecord(r, lines) {
  let html = '<div class="med-guide-card">';
  const pkgCheck = cleanPackageDashes(lines[0]);
  let startIdx = 0;

  if (pkgCheck) {
    startIdx = 1;
    html += `<div class="med-card-header">
      <div class="med-title-wrap">
        <h3 class="med-name">${esc(pkgCheck.name)}</h3>
        ${pkgCheck.lab ? `<span class="med-lab">${esc(pkgCheck.lab)}</span>` : ''}
      </div>
      ${pkgCheck.pkg ? `<span class="rx-pkg">${esc(pkgCheck.pkg)}</span>` : ''}
    </div>`;
  }

  html += '<div class="med-badges-row">';
  if (r.active) {
    html += `<span class="med-badge active-ing"><b>Princípio Ativo:</b> ${esc(r.active)}</span>`;
  }
  if (r.species) {
    html += `<span class="med-badge species-badge">🐾 ${esc(r.species)}</span>`;
  }
  if (r.route) {
    html += `<span class="med-badge route-badge">💉 Via ${esc(r.route)}</span>`;
  }
  html += '</div>';

  html += '<div class="med-details-list">';
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (/^Administrar\s/i.test(l)) {
      html += `<div class="rx-directive"><span class="dir-icon">⏱</span><div><small class="dir-title">Posologia recomendada:</small><p class="dir-text">${esc(l)}</p></div></div>`;
      continue;
    }

    const fm = l.match(/^([^:]{2,30}):\s*(.*)$/);
    if (fm) {
      const k = fm[1].trim();
      const v = fm[2].trim();
      const isWarning = /contra|adverso|incompat/i.test(k);
      const isDose = /dose/i.test(k);
      const isObs = /obs/i.test(k);

      if (isWarning) {
        html += `<div class="doc-field doc-warning">
          <div class="field-label">⚠️ <b>${esc(k)}</b></div>
          <p class="field-val">${esc(v)}</p>
        </div>`;
      } else {
        html += `<div class="rx-spec-row ${isDose ? 'rx-dose-row' : ''} ${isObs ? 'rx-obs-row' : ''}">
          <span class="rx-spec-label">${esc(k)}:</span>
          <span class="rx-spec-val">${esc(v)}</span>
        </div>`;
      }
    } else {
      html += `<p class="field-val">${esc(l)}</p>`;
    }
  }
  html += '</div></div>';
  return html;
}

function formatClinicaRecord(r, lines) {
  let html = '';
  const sections = [];
  let currentSec = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const up = l.toUpperCase();

    if (up === 'VISÃO GERAL' || up.startsWith('VISÃO GERAL')) {
      if (currentSec && currentSec.type !== 'overview') sections.push(currentSec);
      if (!currentSec || currentSec.type !== 'overview') {
        currentSec = { id: 'sec-overview', type: 'overview', title: 'Visão Geral', badge: '📋 Visão Geral', lines: [] };
      }
    } else if (up.includes('PRESCRIÇÃO HOSPITALAR') || up.includes('CONDUTA HOSPITALAR')) {
      if (currentSec && currentSec.type !== 'hospital') {
        sections.push(currentSec);
        currentSec = { id: 'sec-hospital', type: 'hospital', title: 'Hospitalar', badge: '🏥 Conduta Hospitalar', lines: [] };
      }
      currentSec.lines.push(l);
    } else if (up.includes('PRESCRIÇÃO DOMICILIAR')) {
      if (currentSec && currentSec.type !== 'domiciliar') {
        sections.push(currentSec);
        currentSec = { id: 'sec-domiciliar', type: 'domiciliar', title: 'Prescrição', badge: '💊 Prescrição Domiciliar', lines: [] };
      }
    } else if (up.startsWith('SOLICITAÇÕES') || up.startsWith('SOLICITAÇÕES:')) {
      if (currentSec && currentSec.type !== 'solicitacoes') {
        sections.push(currentSec);
        currentSec = { id: 'sec-exames', type: 'solicitacoes', title: 'Exames', badge: '🔬 Exames Solicitados', lines: [] };
      }
    } else if (up.startsWith('RECOMENDAÇÕES') || up.startsWith('RECOMENDAÇÕES:')) {
      if (currentSec && currentSec.type !== 'recomendacoes') {
        sections.push(currentSec);
        currentSec = { id: 'sec-recomendacoes', type: 'recomendacoes', title: 'Orientações', badge: '🛡️ Orientações ao Tutor', lines: [] };
      }
    } else {
      if (!currentSec) {
        currentSec = { id: 'sec-overview', type: 'overview', title: 'Visão Geral', badge: '📋 Visão Geral', lines: [] };
      }
      currentSec.lines.push(l);
    }
  }
  if (currentSec) sections.push(currentSec);

  // Jump Strip para navegação rápida
  if (sections.length > 1) {
    html += '<nav class="doc-jump-strip" aria-label="Navegação rápida">';
    sections.forEach(s => {
      html += `<button type="button" class="doc-jump-btn" data-target="${s.id}">${s.badge}</button>`;
    });
    html += '</nav>';
  }

  // Renderização das seções didáticas
  sections.forEach(s => {
    html += `<section class="doc-section section-${s.type}" id="${s.id}">`;
    html += `<div class="doc-section-head"><h3 class="section-title"><span class="section-badge">${s.badge}</span></h3></div>`;

    if (s.type === 'overview') {
      html += '<div class="doc-overview-grid">';
      s.lines.forEach(l => {
        const fm = l.match(/^([^:]{2,30}):\s*(.*)$/);
        if (fm) {
          const k = fm[1].trim();
          const v = fm[2].trim();
          const isWarning = /complicaç/i.test(k);
          const isSymptoms = /sinais/i.test(k);
          const isContext = /contexto/i.test(k);
          const cls = isWarning ? 'doc-field doc-warning' : (isSymptoms ? 'doc-field doc-symptoms' : (isContext ? 'doc-field doc-context' : 'doc-field'));
          const icon = isWarning ? '⚠️ ' : (isSymptoms ? '🩺 ' : (isContext ? '🔍 ' : '📌 '));
          html += `<div class="${cls}">
            <div class="field-label">${icon}<b>${esc(k)}</b></div>
            <p class="field-val">${esc(v)}</p>
          </div>`;
        } else {
          html += `<p class="field-val">${esc(l)}</p>`;
        }
      });
      html += '</div>';
    } else if (s.type === 'hospital') {
      html += '<div class="doc-hospital-body">';
      let inProcedures = false;
      let inDrugs = false;

      s.lines.forEach(l => {
        if (/procedimentos\s*e\s*manejo/i.test(l)) {
          if (inProcedures) html += '</ul>';
          html += '<h4 class="hospital-subhead">📋 Procedimentos & Manejo Imediato</h4><ul class="hospital-checklist">';
          inProcedures = true;
          inDrugs = false;
        } else if (/medicamentos/i.test(l)) {
          if (inProcedures) { html += '</ul>'; inProcedures = false; }
          html += '<h4 class="hospital-subhead">💉 Medicamentos de Internação & Emergência</h4><div class="hospital-drugs-grid">';
          inDrugs = true;
        } else if (l.startsWith('-') || l.startsWith('•')) {
          const cleanItem = l.replace(/^[-•*]\s*/, '').trim();
          if (inDrugs) {
            html += `<div class="hospital-drug-card"><span class="drug-bullet">✚</span><span class="drug-text">${esc(cleanItem)}</span></div>`;
          } else {
            html += `<li><span class="check-bullet">✓</span><span>${esc(cleanItem)}</span></li>`;
          }
        } else {
          html += `<p class="hospital-note">${esc(l)}</p>`;
        }
      });
      if (inProcedures) html += '</ul>';
      if (inDrugs) html += '</div>';
      html += '</div>';
    } else if (s.type === 'domiciliar') {
      html += '<div class="doc-domiciliar-body">';
      let i = 0;
      while (i < s.lines.length) {
        const l = s.lines[i];
        if (/^Uso\s/i.test(l)) {
          html += `<div class="rx-route-divider"><span class="route-icon">💊</span><b>${esc(l)}</b></div>`;
          i++;
          continue;
        }

        const pkgCheck = cleanPackageDashes(l);
        if (pkgCheck) {
          html += '<div class="rx-card">';
          html += `<div class="rx-card-head">
            ${pkgCheck.num ? `<span class="rx-num">${esc(pkgCheck.num)}</span>` : ''}
            <div class="rx-name-wrap">
              <strong class="rx-name">${esc(pkgCheck.name)}</strong>
              ${pkgCheck.lab ? `<span class="rx-lab">${esc(pkgCheck.lab)}</span>` : ''}
            </div>
            ${pkgCheck.pkg ? `<span class="rx-pkg">${esc(pkgCheck.pkg)}</span>` : ''}
          </div>`;

          i++;
          while (i < s.lines.length) {
            const nextLine = s.lines[i];
            if (cleanPackageDashes(nextLine) || /^Uso\s/i.test(nextLine)) {
              break;
            }
            if (/^Administrar\s/i.test(nextLine)) {
              html += `<div class="rx-directive"><span class="dir-icon">⏱</span><div><small class="dir-title">Posologia recomendada:</small><p class="dir-text">${esc(nextLine)}</p></div></div>`;
            } else {
              const fm = nextLine.match(/^([^:]{2,30}):\s*(.*)$/);
              if (fm) {
                const k = fm[1].trim();
                const v = fm[2].trim();
                const isDose = /dose/i.test(k);
                const isObs = /obs/i.test(k);
                html += `<div class="rx-spec-row ${isDose ? 'rx-dose-row' : ''} ${isObs ? 'rx-obs-row' : ''}">
                  <span class="rx-spec-label">${esc(k)}:</span>
                  <span class="rx-spec-val">${esc(v)}</span>
                </div>`;
              } else {
                html += `<div class="rx-spec-row"><span class="rx-spec-val">${esc(nextLine)}</span></div>`;
              }
            }
            i++;
          }
          html += '</div>';
          continue;
        } else {
          html += `<p class="rx-extra">${esc(l)}</p>`;
          i++;
        }
      }
      html += '</div>';
    } else if (s.type === 'solicitacoes') {
      html += '<div class="doc-exams-card"><ul class="exams-list">';
      s.lines.forEach(l => {
        const item = l.replace(/^[-•*]\s*/, '').trim();
        html += `<li><span class="exam-icon">🧪</span><span>${esc(item)}</span></li>`;
      });
      html += '</ul></div>';
    } else if (s.type === 'recomendacoes') {
      html += '<div class="doc-guidelines-card"><ul class="guidelines-list">';
      s.lines.forEach(l => {
        const item = l.replace(/^[-•*]\s*/, '').trim();
        const isReturn = /retorn/i.test(item);
        const icon = isReturn ? '📅' : '✓';
        const cls = isReturn ? 'guideline-item guideline-return' : 'guideline-item';
        html += `<li class="${cls}"><span class="guide-icon">${icon}</span><span>${esc(item)}</span></li>`;
      });
      html += '</ul></div>';
    }

    html += '</section>';
  });

  return html;
}

function formatClinicalDoc(r) {
  if (!r?.text) return '';

  // 1. Unwrapping de quebras de linha indevidas
  const rawLines = r.text.split('\n').map(l => l.trim()).filter(Boolean);
  const lines = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (lines.length > 0) {
      const prev = lines[lines.length - 1];
      const isHeader = line === line.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(line) && line.length < 100;
      const isList = /^([-•*]|\d+\.)\s/.test(line);
      const isField = /^([^:]{2,35}:)/.test(line);
      const prevEndsSentence = /[.:;!?]$/.test(prev);
      const prevIsHeader = prev === prev.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(prev);

      if (!isHeader && !isList && !isField && !prevEndsSentence && !prevIsHeader) {
        lines[lines.length - 1] = prev + ' ' + line;
        continue;
      }
    }
    lines.push(line);
  }

  // Remove título redundante do topo
  if (lines.length > 0 && lines[0].toLowerCase() === r.title.toLowerCase()) {
    lines.shift();
  }

  if (r.doc === 'posologia') {
    return formatPosologiaRecord(r, lines);
  }

  return formatClinicaRecord(r, lines);
}

function openRecord(id) {
  const r = data.records.find(r => r.id === id);
  if (!r) return;

  currentRecord = id;
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 15);
  write('recent', recent);

  const isFav = favs.includes(id);
  const isDone = done.includes(id);

  $('#readerContent').innerHTML = `
    <div class="readerhead">
      <div>
        <span class="eyebrow">${esc(r.group)}</span>
        <h2>${esc(r.title)}</h2>
      </div>
      <button type="button" class="icon" id="closeReader" aria-label="Fechar conduta">✕</button>
    </div>
    <div class="readerbody">
      <div class="readertools">
        <button type="button" class="btn secondary" id="recordFav">${isFav ? '♥ Salvo nos favoritos' : '♡ Salvar favorito'}</button>
        <button type="button" class="btn secondary" id="markDone">${isDone ? '✓ Marcado como revisado' : 'Marcar como revisado'}</button>
      </div>

      <div class="readergrid">
        <article class="source-text">
          ${formatClinicalDoc(r)}
        </article>

        <aside class="readeraside">
          <div class="aside-block">
            <div class="eyebrow">DADOS CLÍNICOS</div>
            <div class="aside-detail-item">
              <span class="aside-label">Grupo / Especialidade:</span>
              <strong>${esc(r.group)}</strong>
            </div>
            <div class="aside-detail-item">
              <span class="aside-label">Espécie indicada:</span>
              <span>${esc(r.species || 'Cães e Gatos')}</span>
            </div>
            ${r.route ? `
              <div class="aside-detail-item">
                <span class="aside-label">Via de administração:</span>
                <span>${esc(r.route)}</span>
              </div>
            ` : ''}
            ${r.active ? `
              <div class="aside-detail-item">
                <span class="aside-label">Princípio ativo:</span>
                <span>${esc(r.active)}</span>
              </div>
            ` : ''}
          </div>

          <div class="aside-block" style="margin-top: 24px;">
            <div class="eyebrow">CADERNO CLÍNICO</div>
            <label for="note">Anotações e condutas deste paciente/caso:</label>
            <textarea id="note" placeholder="Registre doses personalizadas, associações ou observações clínicas do atendimento...">${esc(notes[id] || '')}</textarea>
            <small class="muted">Salvo automaticamente no seu dispositivo.</small>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Rolagem suave com os botões da barra rápida de seções
  document.querySelectorAll('.doc-jump-btn').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.dataset.target;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  });

  $('#closeReader').onclick = () => $('#reader').close();
  $('#recordFav').onclick = () => {
    favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    write('favorites', favs);
    $('#recordFav').textContent = favs.includes(id) ? '♥ Salvo nos favoritos' : '♡ Salvar favorito';
  };
  $('#markDone').onclick = () => {
    done = done.includes(id) ? done.filter(x => x !== id) : [...done, id];
    write('done', done);
    $('#markDone').textContent = done.includes(id) ? '✓ Marcado como revisado' : 'Marcar como revisado';
  };
  $('#note').oninput = e => {
    notes[id] = e.target.value;
    write('notes', notes);
  };

  if (!$('#reader').open) {
    $('#reader').showModal();
    $('#reader').scrollTop = 0;
  }
}


function study() {
  const pct = Math.round((done.length / data.records.length) * 100);
  const activeNotes = Object.entries(notes).filter(([, v]) => v && v.trim());

  return head('CENTRAL DE CONSULTA', 'Caderno Clínico.', 'Acompanhe seus protocolos consultados, retome suas anotações de casos e acesse o histórico rápido.') +
  `<div class="stats">
    <div class="stat"><span class="stat-symbol">✓</span><div><strong>${done.length}</strong><small>Condutas revisadas</small></div></div>
    <div class="stat"><span class="stat-symbol">♡</span><div><strong>${favs.length}</strong><small>Favoritos de rotina</small></div></div>
    <div class="stat"><span class="stat-symbol">✎</span><div><strong>${activeNotes.length}</strong><small>Anotações clínicas</small></div></div>
    <div class="stat"><span class="stat-symbol">📈</span><div><strong>${pct}%</strong><small>Do acervo consultado</small></div></div>
  </div>

  <div class="progress-container">
    <div class="progress-bar" style="width: ${pct}%"></div>
  </div>

  <div class="sectionhead">
    <div>
      <h2>Anotações de casos e condutas</h2>
      <p>Registros e observações salvas durante seus atendimentos.</p>
    </div>
    ${activeNotes.length ? '<button type="button" class="btn secondary" id="export">Exportar anotações (.txt) ↓</button>' : ''}
  </div>

  ${activeNotes.length ? `
    <div class="notes-grid">
      ${activeNotes.map(([id, text]) => {
        const r = data.records.find(item => item.id === id);
        return `
          <div class="studyitem" data-open="${id}">
            <div>
              <span class="tag">${esc(r?.group || 'Clínica Geral')}</span>
              <b>${esc(r?.title || id)}</b>
              <p class="studyitem-text">${esc(text.slice(0, 140))}${text.length > 140 ? '…' : ''}</p>
            </div>
            <span class="studyitem-arrow">↗</span>
          </div>
        `;
      }).join('')}
    </div>
  ` : `
    <div class="empty">
      <p>Nenhuma anotação registrada ainda.</p>
      <p class="muted">Ao consultar uma ficha clínica ou medicamento, você pode registrar anotações e dosagens específicas do paciente.</p>
    </div>
  `}

  <div class="sectionhead" style="margin-top: 35px;">
    <h2>Consultados recentemente no plantão</h2>
  </div>
  <div class="records">
    ${recent.length
      ? recent.map(id => data.records.find(r => r.id === id)).filter(Boolean).slice(0, 6).map(card).join('')
      : '<p class="muted">Os últimos protocolos abertos aparecerão aqui para retorno rápido.</p>'
    }
  </div>`;
}

function about() {
  return head('TRANSPARÊNCIA', 'Sobre o sistema.', 'Guia técnico de referência médica veterinária para consulta e tomada de decisão.') +
  `<div class="about">
    <h2>Apresentação</h2>
    <p>O sistema foi desenvolvido como uma ferramenta prática e ágil de suporte à rotina clínica e de plantão médico veterinário em pequenos animais (cães e gatos).</p>

    <h2>Estrutura do Acervo</h2>
    <p>O sistema reúne <strong>781 fichas técnicas</strong> divididas em:</p>
    <ul>
      <li><strong>Biblioteca Clínica:</strong> Diagnósticos, sinais clínicos, orientações de exames, prescrições hospitalares e prescrições domiciliares distribuídas em 17 especialidades.</li>
      <li><strong>Guia de Medicamentos:</strong> Consulta de princípios ativos, apresentações comerciais, doses em mg/kg para cães e gatos, vias e recomendações farmacológicas.</li>
    </ul>

    <h2>Privacidade</h2>
    <p>Suas anotações, histórico de consulta e favoritos ficam armazenados com total privacidade diretamente no navegador do seu dispositivo. Nenhuma informação sobre pacientes ou prontuários é enviada para a internet.</p>

    <div style="margin-top: 25px;">
      <a class="btn" href="#biblioteca">Acessar biblioteca clínica ↗</a>
    </div>
  </div>`;
}

function setupSearchListeners() {
  const searchInput = $('#search');
  const searchClear = $('#searchClear');
  const searchSubmit = $('#searchSubmit');

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      query = e.target.value;
      page = 1;
      if (view === 'inicio') {
        if (query.trim().length >= 2) {
          go('biblioteca', '', query);
        }
      } else {
        renderResults();
      }
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        query = searchInput.value;
        page = 1;
        if (view === 'inicio') {
          go('biblioteca', '', query);
        } else {
          renderResults();
        }
      }
    });
  }

  searchClear?.addEventListener('click', () => {
    query = '';
    page = 1;
    if (view === 'inicio') {
      render();
    } else {
      render();
      $('#search')?.focus();
    }
  });

  searchSubmit?.addEventListener('click', () => {
    query = searchInput?.value || '';
    page = 1;
    if (view === 'inicio') {
      go('biblioteca', '', query);
    } else {
      renderResults();
    }
  });
}

function render() {
  const currentHash = location.hash.slice(1) || 'inicio';
  view = titles[currentHash] ? currentHash : 'inicio';

  if (prevView && prevView !== view) {
    group = '';
    species = '';
    route = '';
    section = '';
    page = 1;
  }
  prevView = view;

  $('#crumb').textContent = titles[view];

  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === view);
  });

  closeMobileMenu();

  const main = $('#main');
  if (!main) return;

  if (view === 'inicio') {
    main.innerHTML = home();
  } else if (['biblioteca', 'medicamentos', 'favoritos'].includes(view)) {
    main.innerHTML = library();
  } else if (view === 'estudos') {
    main.innerHTML = study();
  } else {
    main.innerHTML = about();
  }

  setupSearchListeners();
  bindCards();

  if (['biblioteca', 'medicamentos', 'favoritos'].includes(view)) {
    renderResults();

    ['group', 'species', 'route', 'section'].forEach(id => {
      $('#' + id)?.addEventListener('change', e => {
        if (id === 'group') group = e.target.value;
        if (id === 'species') species = e.target.value;
        if (id === 'route') route = e.target.value;
        if (id === 'section') section = e.target.value;
        page = 1;
        renderResults();
      });
    });

    $('#clear')?.addEventListener('click', () => {
      query = '';
      group = '';
      species = '';
      route = '';
      section = '';
      page = 1;
      render();
    });
  }

  if (view === 'estudos') {
    $('#export')?.addEventListener('click', () => {
      const activeNotes = Object.entries(notes).filter(([, v]) => v && v.trim());
      const content = activeNotes.map(([id, v]) => {
        const r = data.records.find(item => item.id === id);
        return `========================================\n${r?.title || id}\nGrupo: ${r?.group || 'Clínica Geral'}\nEspécie: ${r?.species || 'Cães e Gatos'}\n----------------------------------------\n${v}\n`;
      }).join('\n\n');

      const blob = new Blob([content || 'Nenhuma anotação registrada.'], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'anotacoes-clinicas-dra-nataly-michel.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
}

// Event Listeners globais
$('#theme')?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  write('dark', document.body.classList.contains('dark'));
});

// Abertura do menu mobile
$('#menu')?.addEventListener('click', e => {
  e.stopPropagation();
  openMobileMenu();
});

// Fechamento pelo botão X do menu
$('#closeSidebar')?.addEventListener('click', e => {
  e.stopPropagation();
  closeMobileMenu();
});

// Fechamento ao tocar no backdrop
['click', 'pointerdown'].forEach(evt => {
  $('#sidebarBackdrop')?.addEventListener(evt, e => {
    e.preventDefault();
    closeMobileMenu();
  });
});

// Fechamento automático ao clicar em QUALQUER link dentro do sidebar
$('#sidebar')?.addEventListener('click', e => {
  if (e.target.closest('a')) {
    closeMobileMenu();
  }
});

// Gesto de swipe para fechar o menu no celular
let touchStartX = 0;
let touchStartY = 0;
$('#sidebar')?.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

$('#sidebar')?.addEventListener('touchmove', e => {
  const diffX = touchStartX - e.touches[0].clientX;
  const diffY = Math.abs(touchStartY - e.touches[0].clientY);
  if (diffX > 45 && diffX > diffY) {
    closeMobileMenu();
  }
}, { passive: true });

$('#help')?.addEventListener('click', () => {
  go('sobre');
});

$('#reader')?.addEventListener('click', e => {
  if (e.target === $('#reader')) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      e.target.close();
    }
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelectorAll('[data-nav]').forEach(a => {
  a.addEventListener('click', () => {
    query = '';
    group = '';
    species = '';
    route = '';
    section = '';
    page = 1;
    closeMobileMenu();
    if (location.hash === a.getAttribute('href')) {
      render();
    }
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMobileMenu();
  }
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    $('#search')?.focus();
  }
});

// Inicialização com carregamento de dados
fetch('data.json')
  .then(r => {
    if (!r.ok) throw new Error('Falha ao carregar data.json');
    return r.json();
  })
  .then(d => {
    data = d;
    render();
  })
  .catch(() => {
    const main = $('#main');
    if (main) {
      main.innerHTML = `
        <div class="empty">
          <h2>Não foi possível carregar o acervo clínico.</h2>
          <p>Verifique sua conexão ou recarregue a página.</p>
          <button type="button" class="btn" onclick="location.reload()">Recarregar página</button>
        </div>
      `;
    }
  });
