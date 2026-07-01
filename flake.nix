{
  description = "ft_trascendence - LMS Platform with full observability stack";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems f;
    in {
      devShells = forAllSystems (system: let
        pkgs = nixpkgs.legacyPackages.${system};
        commonPackages = [
          pkgs.git
          pkgs.gnumake
        ];
        nodePackages = [
          pkgs.nodejs_22
          pkgs.pnpm
          pkgs.typescript
        ];
        containerPackages = [
          pkgs.docker
          pkgs.docker-compose
          pkgs.skopeo
        ];
        k8sPackages = [
          pkgs.kubectl
          pkgs.kubernetes-helm
          pkgs.k9s
          pkgs.kustomize
        ];
      in {
        dev = pkgs.mkShell {
          packages = commonPackages ++ nodePackages ++ containerPackages ++ k8sPackages;
          env.profile = "DEV";
          shellHook = ''
            echo "ft_trascendence dev environment loaded"
            echo "Node: $(node --version) | pnpm: $(pnpm --version)"
          '';
        };

        debug = pkgs.mkShell {
          packages = commonPackages ++ nodePackages ++ containerPackages ++ [
            pkgs.ltrace
            pkgs.strace
            pkgs.curl
            pkgs.jq
          ];
          env.profile = "DEBUG";
        };

        ci = pkgs.mkShell {
          packages = commonPackages ++ nodePackages ++ [
            # Linting & SAST
            pkgs.actionlint
            pkgs.semgrep
            pkgs.hadolint
            pkgs.yamllint
            pkgs.nodePackages.eslint
            # Container scanning
            pkgs.trivy
          ];
          env.profile = "CI";
        };
      });

      # OCI Images built with Nix
      packages = forAllSystems (system: let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        backend-image = pkgs.dockerTools.buildLayeredImage {
          name = "ft-trascendence/backend";
          tag = "latest";
          contents = [
            pkgs.nodejs_22
            pkgs.tini
            pkgs.cacert
          ];
          config = {
            Entrypoint = [ "${pkgs.tini}/bin/tini" "--" ];
            Cmd = [ "${pkgs.nodejs_22}/bin/node" "dist/main.js" ];
            WorkingDir = "/app";
            ExposedPorts = { "3000/tcp" = {}; };
            Env = [
              "NODE_ENV=production"
              "PORT=3000"
            ];
          };
          extraCommands = ''
            mkdir -p app
          '';
        };

        frontend-image = pkgs.dockerTools.buildLayeredImage {
          name = "ft-trascendence/frontend";
          tag = "latest";
          contents = [
            pkgs.nginx
            pkgs.tini
            pkgs.cacert
          ];
          config = {
            Entrypoint = [ "${pkgs.tini}/bin/tini" "--" ];
            Cmd = [ "${pkgs.nginx}/bin/nginx" "-g" "daemon off;" ];
            ExposedPorts = { "80/tcp" = {}; };
          };
        };
      });
    };
}
