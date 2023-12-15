FROM httpd:2.4-alpine
LABEL info="Este es un comentario :P"
WORKDIR /usr/local/apache2/
COPY . htdocs/
ENV key docker
EXPOSE 80
RUN whoami