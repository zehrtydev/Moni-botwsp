# Moni

## Qué es

Moni es una aplicación financiera mobile-first. Una persona registra movimientos desde WhatsApp y consulta su información en un dashboard web autenticado.

## Problema

Reducir la fricción de registrar gastos e ingresos sin obligar al usuario a abrir una aplicación para cada movimiento. El flujo conversacional propone los datos interpretados y solicita confirmación antes de persistir un gasto o ingreso confirmado.

## Usuarios

- Usuarios finales con una cuenta web y un número de WhatsApp vinculado.
- Operación/soporte, cuando debe revisar errores o cambios de número según los procedimientos existentes.

El esquema contempla el rol `admin`, pero no se observa una consola administrativa implementada en las rutas actuales.

## Alcance implementado observable

- Registro e inicio de sesión por correo y contraseña con Supabase Auth.
- Vinculación de un número de WhatsApp en formato E.164 mediante código de pairing.
- Registro conversacional de gastos e ingresos por texto.
- Propuestas, confirmación/rechazo y corrección de movimientos por WhatsApp.
- Consultas conversacionales de gastos del mes y presupuestos.
- Dashboard, historial, estadísticas de seis meses y balance neto.
- Presupuestos mensuales por categoría.
- Edición y eliminación autenticada de gastos desde historial; eliminación de ingresos.
- PWA instalable y endpoint de health check.

El código acepta mensajes de imagen y la base guarda metadatos de media, pero no hay evidencia suficiente en la implementación actual de un flujo completo de OCR/visión que convierta el recibo en un movimiento.

## Integraciones

- Supabase Auth y Postgres/RLS para identidad, datos y políticas de acceso.
- Evolution API 2.3.7 para recibir/enviar mensajes de WhatsApp.
- Ollama opcional mediante API compatible con OpenAI para interpretar gastos; también se contempla un proveedor OpenAI-compatible.
- Caddy como proxy HTTPS en producción.
- Docker Compose para la pila de producción y GitHub Actions para el despliegue al VPS.

## Objetivos conocidos

El objetivo operativo documentado es validar una beta pequeña: que los usuarios registren y confirmen movimientos sin duplicados ni correcciones manuales frecuentes. Las prioridades futuras no están formalmente definidas en el repositorio; ver [ROADMAP.md](ROADMAP.md).

## Fuentes relacionadas

- Inicio y validación: [README.md](../README.md)
- Requisitos históricos: [PRD-registro-gastos-whatsapp-definitivo.md](../PRD-registro-gastos-whatsapp-definitivo.md)
- Operación beta: [BETA-OPERATIONS.md](BETA-OPERATIONS.md)
