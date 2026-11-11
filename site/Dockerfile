# Serves the presentation site as static files. Railway builds this with `site` as the root directory.
# The stable nginx line, pinned to one image by digest so every build serves the same bytes; Dependabot proposes the
# next one.
FROM nginx:1.30.6-alpine@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY . /usr/share/nginx/html
RUN rm /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/security-headers.conf
EXPOSE 8080
