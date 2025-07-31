FROM nginx:alpine




RUN rm -rf /usr/share/nginx/html/*




COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/




COPY nginx.conf /etc/nginx/conf.d/default.conf




EXPOSE 8080




CMD ["nginx", "-g", "daemon off;"]
