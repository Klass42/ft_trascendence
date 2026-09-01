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
      in {
        dev = pkgs.mkShell {
          packages = commonPackages ++ nodePackages ++ containerPackages;
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
    };
}
