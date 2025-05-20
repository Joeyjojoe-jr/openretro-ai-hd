{ pkgs, ... }: {
  channel = "stable";
  packages = [
    (pkgs.python311.withPackages (ps: with ps; [
      pip
      requests
      flask
      nixpkgs.lint.nix
    ]))
  ];
  env = {
    # Example: Set a default env variable
    PYTHONUNBUFFERED = "1";
  };

  idx = {
    extensions = [
      "ms-python.python"
      "esbenp.prettier-vscode"
    ];

    previews = {
      enable = true;
      web = {
        command = ["python3" "main.py"];
        manager = "web";
        env = {
          PORT = "$PORT";
        };
      };
    };

    workspace = {
      onCreate = {
        setup-python = "python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt";
      };
      onStart = {
        run-server = "source .venv/bin/activate && python main.py";
      };
    };
  };
}
