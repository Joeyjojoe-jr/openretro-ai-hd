{
  description = "Development environment for openretro-ai-hd";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.11";
    flake-parts.url = "github:hercules-ci/flake-parts";
    fenix.url = "github:nix-community/fenix";
    # Optional: custom modules
    # my-nix-module.url = "github:my-org/my-nix-module";
  };

  outputs = { self, nixpkgs, flake-parts, fenix, ... }:
    flake-parts.lib.mkFlake { inherit self nixpkgs; } {
      systems = [ "x86_64-linux" ];

      perSystem = { pkgs, system, ... }: {
        # Declare language + tool packages
        packages = {
          pythonEnv = pkgs.python311.withPackages (ps: with ps; [
            pip
            uv
            flask
          ]);
        };

        # Developer shell setup
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            python311
            nixpkgs-fmt
            # Uncomment below if needed:
            # pre-commit
            # statix
            # alejandra
            # nodejs
            # go
          ];

          shellHook = ''
            echo "Welcome to the openretro-ai-hd dev environment!"
            export PYTHONUNBUFFERED=1
          '';
        };
      };
    };
}

