import { z } from 'zod';

/**
 * Validación del paciente. Los campos obligatorios reflejan lo mínimo
 * necesario para identificar a la persona con seguridad clínica
 * (nombre, apellido, sexo) — el resto es información que puede
 * completarse en un segundo momento sin bloquear el registro inicial.
 */
export const PacienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  documento: z.string().trim().max(30).optional().or(z.literal('')),
  fechaNacimiento: z.string().date().optional().or(z.literal('')),
  sexo: z.enum(['femenino', 'masculino'], { errorMap: () => ({ message: 'Seleccioná el sexo' }) }),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  correo: z.string().trim().email('Correo inválido').max(100).optional().or(z.literal('')),
  direccion: z.string().trim().max(200).optional().or(z.literal('')),
  ciudad: z.string().trim().max(100).optional().or(z.literal('')),
  ocupacion: z.string().trim().max(100).optional().or(z.literal('')),
  motivoConsulta: z.string().trim().max(2000).optional().or(z.literal('')),
  antecedentesPersonales: z.string().trim().max(2000).optional().or(z.literal('')),
  antecedentesFamiliares: z.string().trim().max(2000).optional().or(z.literal('')),
  medicamentosActuales: z.string().trim().max(2000).optional().or(z.literal('')),
  alergias: z.string().trim().max(2000).optional().or(z.literal('')),
  observaciones: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type PacienteFormValues = z.infer<typeof PacienteSchema>;

export const CAMPOS_OBLIGATORIOS: (keyof PacienteFormValues)[] = ['nombre', 'apellido', 'sexo'];

/**
 * Traduce los valores validados del formulario a columnas de la tabla
 * `pacientes`. Compartido entre POST y PATCH para que ambos escriban
 * exactamente los mismos campos.
 */
export function mapearPacienteADB(v: PacienteFormValues) {
  return {
    nombre: v.nombre,
    apellido: v.apellido,
    documento: v.documento || null,
    fecha_nacimiento: v.fechaNacimiento || null,
    sexo: v.sexo,
    telefono: v.telefono || null,
    correo: v.correo || null,
    direccion: v.direccion || null,
    ciudad: v.ciudad || null,
    ocupacion: v.ocupacion || null,
    motivo_consulta: v.motivoConsulta || null,
    antecedentes_personales: v.antecedentesPersonales || null,
    antecedentes_familiares: v.antecedentesFamiliares || null,
    medicamentos_actuales: v.medicamentosActuales || null,
    alergias: v.alergias || null,
    observaciones: v.observaciones || null,
  };
}
