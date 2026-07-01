# Nix OCI image build for the backend.
# Build: nix build .#backend-image
# Load: docker load < result
# Or stream directly: nix build .#backend-image --json | jq -r '.[0].outputs.out' | docker load
#
# This produces a minimal OCI image with only:
# - Node.js 22 runtime
# - tini (PID 1 init)
# - CA certificates
# - The compiled application
#
# The actual application dist/ must be copied in via a separate step
# or mounted. For a full CI pipeline, use the multi-stage Dockerfile
# which handles the build step internally.
#
# Usage in flake.nix:
#   packages.${system}.backend-image imports this file
{ pkgs }:

pkgs.dockerTools.buildLayeredImage {
  name = "ft-trascendence/backend";
  tag = "nix";

  contents = [
    pkgs.nodejs_22
    pkgs.tini
    pkgs.cacert
    pkgs.coreutils
  ];

  config = {
    Entrypoint = [ "${pkgs.tini}/bin/tini" "--" ];
    Cmd = [ "${pkgs.nodejs_22}/bin/node" "dist/main.js" ];
    WorkingDir = "/app";
    ExposedPorts = {
      "3000/tcp" = {};
    };
    Env = [
      "NODE_ENV=production"
      "PORT=3000"
      "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
    ];
    Labels = {
      "org.opencontainers.image.source" = "https://github.com/Klass42/ft_trascendence";
      "org.opencontainers.image.description" = "ft_trascendence backend (NestJS)";
    };
  };

  extraCommands = ''
    mkdir -p app
  '';
}
