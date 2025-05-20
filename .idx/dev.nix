--- /dev/null
++ b/.idx/dev.nix
{
  description = "Development environment for openretro-ai-hd";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.11";
    flake-parts.url = "github:hercules-ci/flake-parts";
    fenix.url = "github:nix-community/fenix";

    # For your own modules
    # my-nix-module.url = "github:my-org/my-nix-module";
  };

  outputs = { nixpkgs, flake-parts, fenix, ... }:
    flake-parts.lib.mkflake { inherit nixpkgs; } {
      systems = [ "x86_64-linux" ];

      perSystem = { pkgs, ... }:
      {
        packages = [
          (pkgs.python311.withPackages (ps: with ps; [
            pip
            uv
          ]))
        ];

        devShells.default = pkgs.mkShell {
          packages = with pkgs;
          [
            # Tools
            nixpkgs-fmt
            python311
            # pre-commit
            # statix
            # alejandra

            # Language-specific tools
            # nodejs
            # go
          ];

          # Environment variables to set in the shell
          # FOO = "bar";
        };

        # Nix-LSP
        # You probably want to have a flake-aware LSP configured.
        # See https://github.com/nil/nil
      };

      # This is a simple flake layout. To see the full range of flake-parts options, see
      # https://github.com/hercules-ci/flake-parts/blob/main/README.md
    ]))
  ];
}
