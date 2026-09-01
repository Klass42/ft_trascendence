# diagrama de relaciones prisma
añadir la generacion de un diamagra de flujo
schema-prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "./ERD.md" // O puedes usar .png o .svg si tienes las dependencias necesarias
}

# Arreglar los dockerfiles:
- poner cache mount en los dockerfiles
- un contenedor 1 proceso.
- todos los servicios se despliegan desde caddy, frontend tiene nginx

# Makefile:
- no se ven los puertos en la norma urls.
