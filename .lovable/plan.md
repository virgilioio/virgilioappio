
Diagnóstico confirmado con evidencia actual:
- El `send-whatsapp` sigue fallando por Twilio `63007`: **“Twilio could not find a Channel with the specified From address”** (logs de edge function).
- En DB, el tenant está usando `twilio_from_number = whatsapp:+13167666115` (workspace_automations), que viene del flujo de provisión de número.
- El flujo `provision-whatsapp-number` compra un número Twilio, pero **no registra ese número como WhatsApp Sender** en Channels.
- Sobre templates: hoy **no se están enviando a Twilio/Meta**. En `manage-whatsapp-templates` se guardan en DB y el propio código comenta que por ahora no hace submission real. Además, todos tienen `twilio_content_sid = null`.

Plan de implementación (prioridad: arreglar envío ya):
1) Corregir configuración del sender (bloqueante actual)
- Añadir en `WhatsAppIntegrationCard` un camino explícito para **“Use existing active WhatsApp sender”** (input de número + guardar).
- Guardar en `workspace_automations.config` usando `saveNumber`, apuntando al número que sí está online en Twilio Sender.
- Ajustar copy del botón actual para no inducir error (porque “Enable WhatsApp” hoy compra número, pero no lo deja listo como sender).

2) Endurecer `send-whatsapp` para evitar 500 opacos
- Mantener sanitización E.164.
- Mapear errores Twilio conocidos a mensajes accionables:
  - `63007` => responder 400 con mensaje claro: “El número From no está registrado como WhatsApp Sender activo”.
- Corregir bug potencial: `body.substring(0, 100)` cuando se envía template (body puede venir vacío) para evitar 500 secundarios.
- Persistir `last_message_preview`/`body` usando el texto final realmente enviado (`messageBody`) de forma segura.

3) Alinear UX de templates con realidad técnica (evitar falsa sensación de “approved”)
- En la UI de chat, para primer contacto, permitir solo templates con `twilio_content_sid` válido.
- Si un template no tiene SID, mostrarlo como **“local only / not submitted to Meta”** y no permitir usarlo como template oficial.
- Mantener envío libre solo cuando aplique sesión activa (24h).

4) Ruta de templates (siguiente paso, después de desbloquear envío)
- Opción práctica inmediata: agregar acción admin para capturar/guardar manualmente `twilio_content_sid` en cada template.
- Opción full automatizada: investigar soporte real del gateway para Content API; si es viable, implementar submit + sync de estatus en `manage-whatsapp-templates`.

5) Validación end-to-end
- Probar envío real desde Candidate Chat con el sender activo correcto.
- Caso 1: primer contacto con template válido (con SID) => debe enviar sin 500.
- Caso 2: forzar sender inválido => debe mostrar error claro, no 500 genérico.
- Verificar que consola y logs de `send-whatsapp` queden limpios de `63007` en flujo normal.

Detalles técnicos (archivos objetivo):
- `src/components/settings/WhatsAppIntegrationCard.tsx`
- `src/hooks/useWhatsAppConfig.ts`
- `supabase/functions/send-whatsapp/index.ts`
- `src/components/candidates/WhatsAppChatTab.tsx`
- (opcional fase templates) `supabase/functions/manage-whatsapp-templates/index.ts`

Sin cambios de esquema obligatorios: se puede resolver con `workspace_automations.config` y `whatsapp_templates.twilio_content_sid/approval_status`.
