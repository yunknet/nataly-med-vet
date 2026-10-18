FROM nginx:alpine

# Remove configuração padrão
RUN rm -f /etc/nginx/conf.d/default.conf

# Copia configuração customizada (com gzip, SPA e portas 80/3000)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos do build
COPY dist /usr/share/nginx/html

EXPOSE 80
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
