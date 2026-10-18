# Biblioteca veterinária — Dra. Nataly Michel

Aplicativo estático de consulta e estudo em português, com identidade em branco e azul bebê, tema escuro e navegação responsiva.

## Conteúdo

- 285 páginas do Guia de Prescrição e 84 páginas do Guia de Posologia, 2ª edição.
- Autoria dos materiais: Lígia Rayssa F. de P. Rodrigues. A identidade do aplicativo não substitui a autoria das fontes.
- 170 fichas clínicas, 611 entradas de medicamentos e 17 especialidades.
- Todas as páginas renderizadas em WebP, mantendo diagramação, imagens e créditos. Texto integral pesquisável em Materiais originais.
- Entradas repetidas em categorias diferentes permanecem como aparecem na fonte; o total não representa princípios ativos únicos.

## Recursos

Busca sem distinção de acentos; filtros de especialidade/categoria, espécie, via e tipo de conteúdo; paginação; leitor de fichas; navegação entre páginas; favoritos; notas com salvamento local; progresso de estudo; histórico de leitura; exportação de notas; roteiro com quatro etapas e listas de conferência; tema persistente.

## Executar

Sirva `dist/` por HTTP, por exemplo `python -m http.server 8766 --directory dist`. Não há dependências de compilação. O código usa JavaScript, HTML e CSS. Não abra o HTML diretamente por `file://`, pois o acervo é carregado por fetch.

## Publicar em outra hospedagem

Publique o conteúdo de `dist/` em hospedagem estática HTTPS. Todas as rotas usam fragmentos; não precisam de regras de redirecionamento. O manifesto `.openai/hosting.json` identifica o Site existente; não crie outro projeto ao atualizar.

## Limites

Não há autenticação própria, banco de pacientes, prontuário, cobrança ou sincronização de notas. A hospedagem Sites pode limitar acesso ao proprietário. Dados pessoais de estudo ficam no localStorage do navegador; limpar o armazenamento apaga esses dados. Não inserir dados identificáveis de pacientes. Fontes tipográficas externas têm fallback local.

O conteúdo foi convertido e organizado, sem revisão clínica independente. Filtros não indicam segurança de uso. Espécies nas fichas clínicas são inferidas apenas quando explícitas no título; nos medicamentos, do campo da fonte. Consultar texto integral e original, especialmente doses e unidades. Existem inconsistências editoriais e duplicações no material, preservadas sem correções clínicas silenciosas.

Os PDFs originais estão em `sources/`, excluídos da publicação. O app inclui a representação visual de todas as páginas e transcrição acessível. A distribuição dos materiais requer os direitos correspondentes.

## Manutenção

`extract.py` reconstrói o acervo a partir dos caminhos originais fornecidos. Usa pypdfium2 e Pillow. `inventory.txt` relaciona cada ficha a suas páginas. `verify.py` verifica integridade do índice, páginas e recursos locais. Alterações nos documentos exigem revisão dos delimitadores de extração e validação visual.
