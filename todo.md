# diagrama de relaciones prisma
añadir la generacion de un diamagra de flujo
schema-prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "./ERD.md" // O puedes usar .png o .svg si tienes las dependencias necesarias
}
