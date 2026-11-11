# Serves the presentation site as static files. Railway builds this with `site` as the root directory.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY . /usr/share/nginx/html
RUN rm /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/security-headers.conf
EXPOSE 8080
