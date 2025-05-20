{ pkgs, ... }:

{
  # Use this stable channel
  channel = "stable-23.11";

  # Declare packages needed in your dev environment
  packages = [
    (pkgs.python311.withPackages (ps: with ps; [
      pip
      flask
    ]))
    pkgs.nixpkgs-fmt
    pkgs.python311
  ];

  # Environment variables to set
  env = {
    PYTHONUNBUFFERED = "1";
  };

  # IDX-specific configuration
  idx = {
    extensions = [
      "ms-python.python"
    ];

    previews = {
      enable = true;
    };

    workspace = {
      onCreate = {
        setup-python = ''
          python3 -m venv .venv
          source .venv/bin/activate
          pip install -r requirements.txt || true
        '';
      };
      onStart = {
        run-server = ''
          source .venv/bin/activate
          python main.py || echo "No main.py found"
        '';
      };
    };
  };
}
