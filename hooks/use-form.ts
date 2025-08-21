import { zodResolver } from "@hookform/resolvers/zod";
import { useForm as useReactHookForm, UseFormProps, FieldValues } from "react-hook-form";
import { z } from "zod";

export function useForm<TSchema extends z.ZodRawShape>(
  schema: z.ZodObject<TSchema>,
  options?: Omit<UseFormProps<z.infer<z.ZodObject<TSchema>>>, "resolver">
) {
  return useReactHookForm<z.infer<z.ZodObject<TSchema>>>({
    resolver: zodResolver(schema),
    ...options,
  });
}