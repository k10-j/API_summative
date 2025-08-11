# Academic Research Assistant & Multi-Language Summarizer
The ARA is an academic weapon that I created to facilitate the understanding of different concepts within the Academic or professional realm. the Static frontend app (HTML/CSS/JS) containerized with Docker and served with NGINX. Deployed to two web nodes (Web01, Web02) and load-balanced by HAProxy on Lb01.

# Image details (Docker Hub)
- Docker Hub repo: docker.io/katelor/api_summative
- Image name: katelor/api_summative
- Tag used for submission: v1
- Full image reference: docker.io/katelor/api_summative:v1

# Files in this repo 
API_summative/
├── index.html # Frontend UI
├── style.css # Styling
├── script.js # Frontend logic (summarize/translate)
├── nginx.conf # Custom NGINX config (listens on 8080)
└── dockerfile # Build instructions

1) Build instructions (exact commands I ran locally)
- Build the Docker image (note the final dot)
#docker build -t katelor/api_summative:v1 .
-Quick local test run (maps host 8080 -> container 8080)
docker run -p 8080:8080 katelor/api_summative:v1
Then visit http://localhost:8080 to verify the site loads locally

2) Publish image to Docker Hub (exact commands)
# Log in (I used web flow)
docker login

- Pushed the image
docker push katelor/api_summative:v1
After pushing, I confirmed the image is available on Docker Hub at docker.io/katelor/api_summative:v1.

3) Lab setup (Web01, Web02, Lb01)
I used the provided lab repo as a starting point:
 -cloned the lab
git clone https://github.com/waka-man/web_infra_lab
cd web_infra_lab
# start the three-node environment (web-01, web-02, lb-01)
docker compose up -d

4) Deploying the image on Web01 and Web02 (exact commands to run on each web node)
ssh ubuntu@localhost -p 2211
-on remote:
docker pull katelor/api_summative:v1
docker run -d --name app --restart unless-stopped \  -p 8080:8080 \ katelor/api_summative:v1

5) # HAProxy configuration on Lb01
I edited /etc/haproxy/haproxy.cfg on the load balancer (lb-01). Below is the exact working configuration used:

haproxy
CopyEdit
global
    daemon
    maxconn 256

defaults
    mode http
    timeout connect 5s
    timeout client  50s
    timeout server  50s

frontend http-in
    bind *:80
    default_backend api_summative

backend api_summative
    balance roundrobin
    server web01 172.20.0.11:8080 check
    server web02 172.20.0.12:8080 check
    http-response set-header X-Served-By %[srv_name]
Notes
•	balance roundrobin ensures requests are distributed alternately between web01 and web02.
•	check enables health checks so HAProxy only sends traffic to healthy instances.
•	http-response set-header X-Served-By %[srv_name] adds a response header we use to confirm which server handled each request.
After editing the file, reload HAProxy using:
 : sudo haproxy -sf $(pidof haproxy) -f /etc/haproxy/haproxy.cfg

6) Testing steps & evidence (how I verified round-robin works)
 # Basic browser test
•	Open http://<lb-ip-or-localhost> (lab maps lb-01 to host; in my local lab that was http://localhost) and refresh several times.
•	Because of X-Served-By header, we verify the server that served the last response.

7) # Troubleshooting & common gotchas
•	failed to compute checksum: file not found during docker build
-> Check COPY paths & filename case. Example: script.js vs Script.js. Use ls to confirm.
•	invalid tag: repository name must be lowercase
-> Use lowercase for image names.
•	HAProxy returns 503 or only one backend is used
-> Check health: docker ps on web nodes and confirm app is listening on port 8080. Check haproxy.cfg for correct internal IP addresses (web01 = 172.20.0.11, web02 = 172.20.0.12 in this lab).
•	CORS or API restrictions for frontend-only APIs
-> If any API is blocked by CORS when called directly from the browser, you will need a small backend proxy or use CORS-enabled services.

8) HERE IS THE youtube URL of the 2 min demo
# https://youtu.be/PNziKuUbO5I

