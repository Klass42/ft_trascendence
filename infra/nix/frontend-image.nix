# Nix OCI image build for the frontend (static files served by nginx).
# Build: nix build .#frontend-image
# Load: docker load < result
#
# Produces a minimal image with nginx serving static files.
# The built Vite output (dist/) must be injected into /usr/share/nginx/html.
{ pkgs }:

let
  nginxConf = pkgs.writeText "nginx.conf" ''
    worker_processes auto;
    error_log /dev/stderr;
    pid /tmp/nginx.pid;

    events {
      worker_connections 1024;
    }

    http {
      include ${pkgs.nginx}/conf/mime.types;
      default_type application/octet-stream;

      access_log /dev/stdout;

      sendfile on;
      tcp_nopush on;
      keepalive_timeout 65;
      gzip on;
      gzip_types text/plain text/css application/json application/javascript text/xml;

      server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        location / {
          try_files $uri $uri/ /index.html;
        }

        location /api/ {
          proxy_pass http://backend:3000/;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /health {
          return 200 '{"status":"ok"}';
          add_header Content-Type application/json;
        }
      }
    }
  '';
in

pkgs.dockerTools.buildLayeredImage {
  name = "ft-trascendence/frontend";
  tag = "nix";

  contents = [
    pkgs.nginx
    pkgs.tini
    pkgs.cacert
    pkgs.coreutils
  ];

  config = {
    Entrypoint = [ "${pkgs.tini}/bin/tini" "--" ];
    Cmd = [ "${pkgs.nginx}/bin/nginx" "-c" "${nginxConf}" "-g" "daemon off;" ];
    ExposedPorts = {
      "80/tcp" = {};
    };
    Env = [
      "NGINX_ENTRYPOINT_QUIET_LOGS=1"
    ];
    Labels = {
      "org.opencontainers.image.source" = "https://github.com/Klass42/ft_trascendence";
      "org.opencontainers.image.description" = "ft_trascendence frontend (React/Vite)";
    };
  };

  extraCommands = ''
    mkdir -p usr/share/nginx/html
    mkdir -p tmp
  '';
}
