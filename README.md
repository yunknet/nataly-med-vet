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

Com Node.js 18 ou superior, execute `npm start` e abra `http://127.0.0.1:3000`. Não é necessário instalar pacotes. Execute `npm run check` para verificar o JavaScript e o acervo. Alternativamente, sirva `dist/` com `python -m http.server 8766 --directory dist`. Não abra o HTML diretamente por `file://`, pois o acervo é carregado por fetch.

## Enviar ao GitHub

Repositório de destino informado: https://github.com/yunknet/nataly-med-vet

Extraia o pacote e coloque seu conteúdo na raiz do repositório. Inclua `dist/`, `package.json`, `server.mjs`, `check.mjs`, os scripts de extração/verificação e este README. O diretório `sources/` com PDFs de entrada é local e ignorado pelo Git. Não há workflow de hospedagem ou publicação automática configurado.

## Publicar no Easypanel (VPS)

1. Crie um novo aplicativo no Easypanel selecionando **App**.
2. Na aba **Fonte**:
   - Selecione **Github** e informe o repositório `yunknet/nataly-med-vet`.
   - Branch: `main`
   - Caminho de Build: `/`
   - Construção: Escolha **Dockerfile** (recomendado, usa Nginx otimizado com compressão Gzip e suporte a portas 80 e 3000).
3. Na aba **Domínios**:
   - Adicione seu domínio ou subdomínio (ex: `vet.seudominio.com`).
   - Aponte a porta para `80` (ou `3000`).
4. Clique em **Salvar** e depois em **Implantar**.

## Publicar em outra hospedagem

Quando desejar hospedar, a pasta pública é `dist/`. Todas as rotas usam fragmentos; não precisam de regras de redirecionamento. Este pacote não inclui configuração de Sites nem publica automaticamente em qualquer serviço.

## Instalar na VPS com Nginx direto

O aplicativo é estático: em produção, o Nginx pode servir `dist/` diretamente, sem processo Node.js permanente.

1. Clone o repositório na VPS:

```bash
sudo mkdir -p /var/www
sudo git clone https://github.com/yunknet/nataly-med-vet.git /var/www/nataly-med-vet
```

2. Configure um site no Nginx, substituindo `vet.seudominio.com` pelo domínio desejado:

```nginx
server {
    listen 80;
    server_name vet.seudominio.com;
    root /var/www/nataly-med-vet/dist;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ /\. {
        deny all;
    }
}
```

3. Habilite esse site conforme a distribuição da VPS, execute `sudo nginx -t` e recarregue o Nginx. Configure DNS e HTTPS para o domínio antes de disponibilizar aos usuários.

Para atualizar os arquivos depois de novos commits:

```bash
sudo git -C /var/www/nataly-med-vet pull --ff-only
```

Não é necessário `npm install` ou compilação. O comando `npm start` serve para prévia local e escuta somente em `127.0.0.1`. A configuração Nginx acima entrega acesso sem login; se o produto exigir acesso restrito, adicione autenticação na infraestrutura antes de disponibilizá-lo.

## Limites

Não há autenticação própria, banco de pacientes, prontuário, cobrança ou sincronização de notas. Dados pessoais de estudo ficam no localStorage do navegador; limpar o armazenamento apaga esses dados. Não inserir dados identificáveis de pacientes. Fontes tipográficas externas têm fallback local.

O conteúdo foi convertido e organizado, sem revisão clínica independente. Filtros não indicam segurança de uso. Espécies nas fichas clínicas são inferidas apenas quando explícitas no título; nos medicamentos, do campo da fonte. Consultar texto integral e original, especialmente doses e unidades. Existem inconsistências editoriais e duplicações no material, preservadas sem correções clínicas silenciosas.

Os PDFs originais estão em `sources/`, excluídos da publicação. O app inclui a representação visual de todas as páginas e transcrição acessível. A distribuição dos materiais requer os direitos correspondentes.

## Manutenção

`extract.py` reconstrói o acervo a partir de `sources/clinica.pdf` e `sources/posologia.pdf`. Usa pypdfium2 e Pillow. A foto já acompanha o app; para recriá-la, forneça `sources/nataly.jpg`. `inventory.txt` relaciona cada ficha a suas páginas. `verify.py` verifica integridade do índice, páginas e recursos locais. Alterações nos documentos exigem revisão dos delimitadores de extração e validação visual.
