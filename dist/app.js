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
  fluxo: 'Consulta guiada',
  estudos: 'Meu estudo',
  favoritos: 'Favoritos',
  sobre: 'Sobre a biblioteca'
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

function searchBox(placeholder = 'Busque por condição clínica, medicamento ou princípio ativo…') {
  return `<div class="searchbar">
    <div class="searchbox">
      <span class="search-icon">⌕</span>
      <input id="search" type="search" aria-label="Pesquisar na biblioteca" placeholder="${placeholder}" value="${esc(query)}" autocomplete="off">
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
    <button class="favorite" data-fav="${r.id}" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" title="${isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}">${isFav ? '♥' : '♡'}</button>
    <span class="tag">${esc(r.group)}</span>
    <h3>${esc(r.title)}</h3>
    <p>${esc(r.summary)}</p>
    <div class="meta">
      <span>${esc(r.species || 'Pequenos animais')}</span>
      ${r.route ? `<span> · ${esc(r.route)}</span>` : ''}
      ${isDone ? '<span class="badge-done">✓ Estudado</span>' : ''}
    </div>
    <button class="btn card-btn" data-open="${r.id}">Consultar conteúdo <span>↗</span></button>
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

  return head('BEM-VINDO À SUA BIBLIOTECA', 'Mais clareza para cuidar.', 'Seu acervo de referência organizado para a rotina veterinária.') +
  `<section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">CONHECIMENTO A SERVIÇO DO CUIDADO</div>
      <h2>Uma boa conduta começa<br>com boas referências.</h2>
      <p>Explore as fichas de clínica médica e medicamentos em um espaço prático, feito para acompanhar o seu atendimento e o seu estudo.</p>
      <div class="hero-actions">
        <a class="btn" href="#biblioteca">Explorar biblioteca clínica <span>↗</span></a>
        <a class="btn secondary" href="#medicamentos">Guia de medicamentos <span>↗</span></a>
      </div>
    </div>
    <img class="hero-photo" src="assets/nataly.webp" alt="Dra. Nataly Michel, médica veterinária">
    <span class="hero-signature">Dra. Nataly Michel · Médica veterinária</span>
  </section>

  <div class="stats">
    <div class="stat"><span class="stat-symbol">♡</span><div><strong>${clinical.length}</strong><small>Condições clínicas</small></div></div>
    <div class="stat"><span class="stat-symbol">✚</span><div><strong>${meds.length}</strong><small>Entradas de medicamentos</small></div></div>
    <div class="stat"><span class="stat-symbol">⌘</span><div><strong>${gs.length}</strong><small>Especialidades</small></div></div>
    <div class="stat"><span class="stat-symbol">▤</span><div><strong>${data.records.length}</strong><small>Fichas catalogadas</small></div></div>
  </div>

  ${searchBox('Busque uma condição clínica, medicamento ou princípio ativo…')}

  <div class="homegrid">
    <section>
      <div class="sectionhead">
        <div>
          <h2>Explore por especialidade</h2>
          <p>Acesse rapidamente as fichas clínicas categorizadas.</p>
        </div>
        <a class="textlink" href="#biblioteca">Ver todas ↗</a>
      </div>
      <div class="specialties">
        ${['Cardiologia', 'Dermatologia', 'Gastroenterologia', 'Nefrologia', 'Infectologia', 'Pneumologia'].filter(g => gs.includes(g)).map((g, i) => `
          <button type="button" class="specialty" data-group="${g}">
            <span class="glyph">${['♡', '◌', '≋', '◒', '✧', '♧'][i]}</span>
            <b>${g}</b>
            <small>${clinical.filter(r => r.group === g).length} conteúdos <span>↗</span></small>
          </button>
        `).join('')}
      </div>
    </section>

    <section>
      <div class="sectionhead">
        <h2>Consulta guiada</h2>
      </div>
      <div class="guidebox">
        <div class="eyebrow">ROTEIRO PASSO A PASSO</div>
        <h3>Da dúvida à conduta.</h3>
        <p class="muted">Um roteiro prático para organizar a pesquisa e conferir os pontos essenciais de cada caso.</p>
        <div class="stepsmini">
          <div><i>1</i>Defina o assunto</div>
          <div><i>2</i>Explore o conteúdo</div>
          <div><i>3</i>Revise os pontos-chave</div>
          <div><i>4</i>Registre anotações</div>
        </div>
        <a class="btn secondary" href="#fluxo">Iniciar roteiro →</a>
      </div>
    </section>
  </div>

  <div class="sectionhead">
    <h2>${recent.length ? 'Continue de onde parou' : 'Destaques para consulta rápida'}</h2>
    <a href="#estudos" class="textlink">Meu estudo ↗</a>
  </div>
  <div class="records">
    ${(recent.length
      ? recent.map(id => data.records.find(r => r.id === id)).filter(Boolean)
      : clinical.filter(r => /doença renal crônica|dermatite atópica canina|diabetes mellitus/i.test(r.title))
    ).slice(0, 3).map(card).join('')}
  </div>

  <div class="notice">
    <strong>Aviso profissional:</strong> Conteúdo técnico de apoio ao estudo e à consulta clínica em pequenos animais. As recomendações, doses e frequências devem ser validadas conforme o julgamento do médico veterinário responsável pelo caso.
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

  let subtitle = 'Explore condições, sinais clínicos e prescrições por especialidade.';
  if (isMed) subtitle = 'Consulte medicamentos por princípio ativo, nome comercial, categoria ou via de uso.';
  if (isFav) subtitle = 'Suas referências clínicas e farmacológicas salvas para consulta imediata.';

  const groupOptions = isFav
    ? [...new Set(data.records.map(r => r.group))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    : groups(isMed ? 'posologia' : 'clinica');

  const speciesOptions = [
    { value: 'cães', text: 'Cães (caninos)' },
    { value: 'gatos', text: 'Gatos (felinos)' }
  ];

  const sectionOptions = [
    { value: 'PRESCRIÇÃO HOSPITALAR', text: 'Prescrição Hospitalar' },
    { value: 'PRESCRIÇÃO DOMICILIAR', text: 'Prescrição Domiciliar' },
    { value: 'Solicitações:', text: 'Solicitações de Exames' },
    { value: 'Recomendações:', text: 'Recomendações e Orientações' }
  ];

  return head('CONSULTA ORGANIZADA', titles[view], subtitle) +
  searchBox(isMed ? 'Pesquise por medicamento, princípio ativo ou indicação…' : 'Pesquise por diagnóstico, sinal clínico ou palavra-chave…') +
  `<div class="filters">
    ${select('group', 'Todas as ' + (isMed ? 'categorias' : 'especialidades'), groupOptions, group)}
    ${select('species', 'Todas as espécies', speciesOptions, species)}
    ${isMed
      ? select('route', 'Todas as vias', [...new Set(data.records.filter(r => r.doc === 'posologia').map(r => r.route))].filter(Boolean).sort(), route)
      : select('section', 'Todos os tipos de prescrição', sectionOptions, section)
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
    if (species && !r.species.toLowerCase().includes(species.toLowerCase())) return false;
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
      <p>Nenhum conteúdo encontrado com os filtros e busca atuais.</p>
      ${otherMatch ? `
        <div class="other-match-box">
          <p>Foram encontrados <strong>${otherMatch.count}</strong> resultados correspondentes em <strong>${otherMatch.name}</strong>.</p>
          <button type="button" class="btn" id="goToOtherSearch">Buscar “${esc(query)}” no ${otherMatch.name} ↗</button>
        </div>
      ` : `
        <p class="muted">Tente buscar por termos mais genéricos ou clique no botão abaixo para reiniciar os filtros.</p>
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
      <button type="button" class="icon" id="closeReader" aria-label="Fechar leitura">✕</button>
    </div>
    <div class="readerbody">
      <div class="readertools">
        <button type="button" class="btn secondary" id="recordFav">${isFav ? '♥ Salvo nos favoritos' : '♡ Salvar favorito'}</button>
        <button type="button" class="btn secondary" id="markDone">${isDone ? '✓ Marcado como estudado' : 'Marcar como estudado'}</button>
      </div>

      <div class="notice">
        Material técnico organizado para consulta clínica e aprendizado contínuo. Avalie individualmente doses, contraindicações e histórico de cada paciente.
      </div>

      <div class="readergrid">
        <article class="source-text">
          ${formatText(r.text)}
        </article>

        <aside class="readeraside">
          <div class="aside-block">
            <div class="eyebrow">DETALHES</div>
            <div class="aside-detail-item">
              <span class="aside-label">Grupo / Especialidade:</span>
              <strong>${esc(r.group)}</strong>
            </div>
            ${r.species ? `
              <div class="aside-detail-item">
                <span class="aside-label">Espécie indicada:</span>
                <span>${esc(r.species)}</span>
              </div>
            ` : ''}
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
            <div class="eyebrow">MEU CADERNO</div>
            <label for="note">Anotações de estudo deste caso</label>
            <textarea id="note" placeholder="Escreva observações clínicas, dúvidas ou pontos para revisar...">${esc(notes[id] || '')}</textarea>
            <small class="muted">Salvo automaticamente no seu navegador.</small>
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
    $('#markDone').textContent = done.includes(id) ? '✓ Marcado como estudado' : 'Marcar como estudado';
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

const flowLabels = ['Definir', 'Explorar', 'Revisar', 'Registrar'];
const checks = [
  ['Identifiquei a espécie e a queixa principal do paciente.', 'Separei as hipóteses diagnósticas e os pontos a esclarecer.'],
  ['Consultei o quadro clínico e os diagnósticos diferenciais.', 'Verifiquei as alternativas terapêuticas e os cenários clínicos.'],
  ['Validei as doses, vias e frequências recomendadas.', 'Verifiquei possíveis contraindicações e interações medicamentosas.'],
  ['Salvei as referências úteis nos meus favoritos.', 'Adicionei observações importantes no meu caderno de estudo.']
];

function flowView() {
  return head('CONSULTA GUIADA', 'Roteiro de conduta clínica.', 'Organize sua pesquisa, confira os pontos críticos e tome decisões com segurança.') +
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
      <h2>${['Qual é a dúvida ou queixa principal?', 'Acesse as referências clínicas adequadas.', 'Valide doses e contraindicações.', 'Registre no caderno e acompanhe a evolução.'][flow]}</h2>
      <p>${[
        'Escolha uma especialidade para filtrar e organizar os tópicos do caso.',
        'Explore as fichas diagnósticas e terapêuticas relacionadas à condição.',
        'Confira posologias com base nas particularidades do paciente e julgamento clínico.',
        'Use anotações e favoritos para manter um registro ágil de aprendizado.'
      ][flow]}</p>

      ${flow === 0 ? `
        <div class="field">
          <label for="flowgroup">Selecione a especialidade de interesse:</label>
          ${select('flowgroup', 'Escolha uma especialidade', groups('clinica'), read('flowgroup', ''))}
        </div>
      ` : ''}

      ${flow === 1 ? `
        <div class="flow-actions">
          <a class="btn" href="#biblioteca">Explorar biblioteca clínica ↗</a>
          <a class="btn secondary" href="#medicamentos">Consultar medicamentos ↗</a>
        </div>
      ` : ''}

      ${flow === 2 ? `
        <div class="flow-actions">
          <a class="btn" href="#medicamentos">Revisar doses e vias ↗</a>
          <a class="btn secondary" href="#biblioteca">Revisar condutas ↗</a>
        </div>
      ` : ''}

      ${flow === 3 ? `
        <div class="flow-actions">
          <a class="btn" href="#estudos">Abrir meu caderno de estudo ↗</a>
        </div>
      ` : ''}

      <div class="checklist">
        <div class="eyebrow" style="margin-bottom: 12px;">PONTOS DE CONFERÊNCIA</div>
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

  return head('SEU ESPAÇO DE APRENDIZADO', 'Meu Estudo.', 'Acompanhe seu progresso de leitura e retome suas anotações clínicas.') +
  `<div class="stats">
    <div class="stat"><span class="stat-symbol">✓</span><div><strong>${done.length}</strong><small>Conteúdos estudados</small></div></div>
    <div class="stat"><span class="stat-symbol">♡</span><div><strong>${favs.length}</strong><small>Favoritos salvos</small></div></div>
    <div class="stat"><span class="stat-symbol">✎</span><div><strong>${activeNotes.length}</strong><small>Anotações registradas</small></div></div>
    <div class="stat"><span class="stat-symbol">📈</span><div><strong>${pct}%</strong><small>Do acervo consultado</small></div></div>
  </div>

  <div class="progress-container">
    <div class="progress-bar" style="width: ${pct}%"></div>
  </div>

  <div class="sectionhead">
    <div>
      <h2>Meu caderno de anotações</h2>
      <p>Registros salvos durante suas leituras.</p>
    </div>
    ${activeNotes.length ? '<button type="button" class="btn secondary" id="export">Exportar anotações ↓</button>' : ''}
  </div>

  ${activeNotes.length ? `
    <div class="notes-grid">
      ${activeNotes.map(([id, text]) => {
        const r = data.records.find(item => item.id === id);
        return `
          <div class="studyitem" data-open="${id}">
            <div>
              <span class="tag">${esc(r?.group || 'Geral')}</span>
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
      <p>Seu caderno ainda não possui anotações.</p>
      <p class="muted">Ao consultar qualquer ficha ou medicamento, use a aba "Meu Caderno" para salvar anotações.</p>
    </div>
  `}

  <div class="sectionhead" style="margin-top: 35px;">
    <h2>Consultados recentemente</h2>
  </div>
  <div class="records">
    ${recent.length
      ? recent.map(id => data.records.find(r => r.id === id)).filter(Boolean).slice(0, 6).map(card).join('')
      : '<p class="muted">Os últimos conteúdos abertos aparecerão aqui.</p>'
    }
  </div>`;
}

function about() {
  return head('TRANSPARÊNCIA', 'Sobre a biblioteca.', 'Conhecimento técnico veterinário organizado para consulta e estudo.') +
  `<div class="about">
    <h2>Apresentação</h2>
    <p>A Biblioteca Veterinária da Dra. Nataly Michel foi criada para atender às necessidades diárias de consulta rápida e estudo aprofundado na clínica médica de pequenos animais e posologia farmacológica.</p>

    <h2>Estrutura do Acervo</h2>
    <p>O acervo conta com <strong>781 fichas</strong> estruturadas, divididas entre:</p>
    <ul>
      <li><strong>Biblioteca Clínica:</strong> Diagnósticos, sinais clínicos, orientações de exames, prescrições hospitalares e domiciliares organizadas por 17 especialidades médicas.</li>
      <li><strong>Guia de Medicamentos:</strong> Consulta de princípios ativos, apresentações comerciais, posologias para cães e gatos, vias e recomendações farmacológicas.</li>
    </ul>

    <h2>Privacidade e Armazenamento Local</h2>
    <p>Suas anotações, histórico de leitura, favoritos e tema escolhido são mantidos com total privacidade diretamente no armazenamento local (localStorage) do seu navegador. Nenhuma informação de navegação ou dados clínicos de pacientes são enviados para servidores externos.</p>

    <h2>Uso Profissional e Clínico</h2>
    <p>Esta ferramenta é destinada exclusivamente a médicos veterinários e estudantes da área. As informações devem ser aplicadas em consonância com a avaliação clínica individual, exames complementares e responsabilidade técnica profissional.</p>

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
        toast('Roteiro concluído! Acesse "Meu Estudo" para acompanhar suas anotações.');
        go('estudos');
      }
    });
  }

  if (view === 'estudos') {
    $('#export')?.addEventListener('click', () => {
      const activeNotes = Object.entries(notes).filter(([, v]) => v && v.trim());
      const content = activeNotes.map(([id, v]) => {
        const r = data.records.find(item => item.id === id);
        return `========================================\n${r?.title || id}\nGrupo: ${r?.group || 'Geral'}\n----------------------------------------\n${v}\n`;
      }).join('\n\n');

      const blob = new Blob([content || 'Nenhuma anotação registrada.'], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'anotacoes-estudo-dra-nataly-michel.txt';
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
$('#closeSidebar')?.addEventListener('click', closeMobileMenu);
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
          <h2>Não foi possível carregar a biblioteca.</h2>
          <p>Verifique sua conexão ou recarregue a página.</p>
          <button type="button" class="btn" onclick="location.reload()">Recarregar página</button>
        </div>
      `;
    }
  });
