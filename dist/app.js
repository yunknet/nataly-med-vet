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
let flow = 0;
let flowChecks = read('flowchecks', {});
let currentRecord = null;

if (read('dark', false)) {
  document.body.classList.add('dark');
}

const titles = {
  inicio: 'Visão geral',
  biblioteca: 'Biblioteca clínica',
  medicamentos: 'Guia de medicamentos',
  fluxo: 'Roteiro de conduta',
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
}

function openMobileMenu() {
  $('#sidebar')?.classList.add('open');
  $('#sidebarBackdrop')?.classList.add('open');
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

  <div class="homegrid">
    <section>
      <div class="sectionhead">
        <div>
          <h2>Especialidades de rotina</h2>
          <p>Selecione uma especialidade para filtrar as condutas clínicas.</p>
        </div>
        <a class="textlink" href="#biblioteca">Ver todas ↗</a>
      </div>
      <div class="specialties">
        ${['Cardiologia', 'Dermatologia', 'Gastroenterologia', 'Nefrologia', 'Infectologia', 'Pneumologia'].filter(g => gs.includes(g)).map((g, i) => `
          <button type="button" class="specialty" data-group="${g}">
            <span class="glyph">${['♡', '◌', '≋', '◒', '✧', '♧'][i]}</span>
            <b>${g}</b>
            <small>${clinical.filter(r => r.group === g).length} condutas <span>↗</span></small>
          </button>
        `).join('')}
      </div>
    </section>

    <section>
      <div class="sectionhead">
        <h2>Roteiro de conduta</h2>
      </div>
      <div class="guidebox">
        <div class="eyebrow">PASSO A PASSO NO ATENDIMENTO</div>
        <h3>Da queixa à prescrição.</h3>
        <p class="muted">Um roteiro rápido para sistematizar o atendimento, conferir hipóteses e validar doses com segurança no plantão.</p>
        <div class="stepsmini">
          <div><i>1</i>Queixa & Hipóteses</div>
          <div><i>2</i>Conduta & Exames</div>
          <div><i>3</i>Prescrição & Doses</div>
          <div><i>4</i>Orientações ao Tutor</div>
        </div>
        <a class="btn secondary" href="#fluxo">Abrir roteiro →</a>
      </div>
    </section>
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

function formatText(text) {
  if (!text) return '';
  return text.split('\n').map(l => {
    const trimmed = l.trim();
    if (!trimmed) return '';
    if (trimmed === trimmed.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(trimmed) && trimmed.length < 140) {
      return `<h3>${esc(trimmed)}</h3>`;
    }
    return `<p>${esc(trimmed.replace(/[-–—]{4,}/g, ' — ')).replace(/^([^:]{2,48}:)/, '<strong>$1</strong>')}</p>`;
  }).join('');
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

      <div class="notice">
        Guia prático para suporte à tomada de decisão clínica. Doses, vias e frequências devem ser ajustadas conforme o quadro individual de cada paciente.
      </div>

      <div class="readergrid">
        <article class="source-text">
          ${formatText(r.text)}
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

const flowLabels = ['Queixa & Hipóteses', 'Conduta & Exames', 'Prescrição & Doses', 'Orientações & Alta'];
const checks = [
  ['Identifiquei a espécie, idade e queixa principal do paciente.', 'Delimitei as hipóteses diagnósticas e diagnósticos diferenciais.'],
  ['Avaliei as orientações de exames complementares recomendados.', 'Consultei o protocolo hospitalar e as medidas imediatas.'],
  ['Conferi dose em mg/kg, via e frequência de administração.', 'Verifiquei contraindicações e interações medicamentosas.'],
  ['Defini a prescrição domiciliar e orientações ao tutor.', 'Registrei as observações clínicas no caderno de plantão.']
];

function flowView() {
  return head('ROTEIRO DE CONDUTA', 'Sistematização do atendimento clínico.', 'Um roteiro objetivo para conduzir o caso clínico com segurança, da queixa inicial à prescrição de alta.') +
  `<div class="flowlayout">
    <div class="flowsteps">
      ${flowLabels.map((t, i) => `
        <button type="button" class="${flow === i ? 'active' : ''}" data-step="${i}">
          <span>0${i + 1}</span> <b>${t}</b>
        </button>
      `).join('')}
    </div>

    <div class="flowpanel">
      <div class="eyebrow">ETAPA ${flow + 1} DE 4</div>
      <h2>${[
        'Qual é a queixa principal ou hipótese?',
        'Consulte a conduta clínica e exames necessários.',
        'Valide posologia, vias e apresentações comerciais.',
        'Prescrição domiciliar e orientações ao tutor.'
      ][flow]}</h2>
      <p>${[
        'Selecione uma especialidade para filtrar e agilizar o acesso às fichas relacionadas ao caso.',
        'Verifique exames complementares solicitados e condutas hospitalares imediatas na ficha da doença.',
        'Confira as opções terapêuticas no Guia de Medicamentos com doses exatas em mg/kg para a espécie.',
        'Finalize as recomendações domiciliares ao tutor e registre observações no seu Caderno Clínico.'
      ][flow]}</p>

      ${flow === 0 ? `
        <div class="field">
          <label for="flowgroup">Selecione a especialidade do caso:</label>
          ${select('flowgroup', 'Escolha uma especialidade', groups('clinica'), read('flowgroup', ''))}
        </div>
      ` : ''}

      ${flow === 1 ? `
        <div class="flow-actions">
          <a class="btn" href="#biblioteca">Acessar biblioteca clínica ↗</a>
          <a class="btn secondary" href="#medicamentos">Consultar medicamentos ↗</a>
        </div>
      ` : ''}

      ${flow === 2 ? `
        <div class="flow-actions">
          <a class="btn" href="#medicamentos">Checar doses e vias ↗</a>
          <a class="btn secondary" href="#biblioteca">Checar conduta clínica ↗</a>
        </div>
      ` : ''}

      ${flow === 3 ? `
        <div class="flow-actions">
          <a class="btn" href="#estudos">Abrir caderno clínico ↗</a>
        </div>
      ` : ''}

      <div class="checklist">
        <div class="eyebrow" style="margin-bottom: 12px;">PONTOS DE CONFERÊNCIA CLÍNICA</div>
        ${checks[flow].map((t, i) => `
          <label class="check-item">
            <input type="checkbox" data-check="${flow}-${i}" ${flowChecks[flow + '-' + i] ? 'checked' : ''}>
            <span>${t}</span>
          </label>
        `).join('')}
      </div>

      <div class="flowbottom">
        <button type="button" class="btn secondary" id="flowprev" ${flow === 0 ? 'disabled' : ''}>← Voltar</button>
        <button type="button" class="btn" id="flownext">${flow === 3 ? 'Concluir roteiro ✓' : 'Próxima etapa →'}</button>
      </div>
    </div>
  </div>`;
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
  } else if (view === 'fluxo') {
    main.innerHTML = flowView();
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

  if (view === 'fluxo') {
    document.querySelectorAll('[data-step]').forEach(btn => {
      btn.onclick = () => {
        flow = +btn.dataset.step;
        render();
      };
    });

    document.querySelectorAll('[data-check]').forEach(chk => {
      chk.onchange = () => {
        flowChecks[chk.dataset.check] = chk.checked;
        write('flowchecks', flowChecks);
      };
    });

    $('#flowgroup')?.addEventListener('change', e => {
      write('flowgroup', e.target.value);
    });

    $('#flowprev')?.addEventListener('click', () => {
      if (flow > 0) {
        flow--;
        render();
      }
    });

    $('#flownext')?.addEventListener('click', () => {
      if (flow < 3) {
        flow++;
        render();
      } else {
        toast('Roteiro concluído! Acesse "Caderno Clínico" para conferir suas anotações.');
        go('estudos');
      }
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

$('#menu')?.addEventListener('click', openMobileMenu);
$('#sidebarBackdrop')?.addEventListener('click', closeMobileMenu);

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
