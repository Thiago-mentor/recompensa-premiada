import { z } from "zod";
import { validatePublicName } from "./publicNameModeration";

export const loginEmailSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const cadastroSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Informe seu nome")
      .max(28, "No máximo 28 caracteres (melhor no celular e nas arenas)")
      .refine((value) => !validatePublicName(value), {
        message: "Esse nome não é permitido. Evite palavrões, pornografia ou ofensas.",
      }),
    username: z
      .string()
      .min(3, "Mínimo 3 caracteres")
      .max(10, "No máximo 10 caracteres")
      .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _")
      .refine((value) => !validatePublicName(value), {
        message: "Esse username não é permitido.",
      }),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmar: z.string(),
    codigoConvite: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmar, {
    message: "Senhas não conferem",
    path: ["confirmar"],
  });

export type LoginEmailInput = z.infer<typeof loginEmailSchema>;
export type CadastroInput = z.infer<typeof cadastroSchema>;
