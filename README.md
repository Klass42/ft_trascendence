# github_template

## Descripcion
Base template for new repositories.

## Structure
```
.
├── makefile                         # make help
└── .github/
    ├── CODEOWNERS.md
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        └── ci.yml                   # CI (commented, enable per project)
```

## Usage
```bash
git clone git@github.com:Aletheios42/github_template.git my-project
cd my-project
rm -rf .git
git init
git add .
git commit -m "chore: init from template"
make env
```

## Requirements

- Docker Engine with the Compose plugin, GNU make

## Customization

- `ci.yml` — uncomment and configure the pipeline
- `CODEOWNERS.md` — update `@Aletheios42` with team members
