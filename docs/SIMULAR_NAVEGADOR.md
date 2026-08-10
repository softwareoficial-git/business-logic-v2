# Guía de Simulación de Navegador con cURL

Para interactuar con la API de `business-logic-v2` mediante `curl`, es necesario simular las cabeceras que un navegador enviaría, especialmente para pasar las protecciones de seguridad (CSRF).

## Requisitos de Seguridad

El backend implementa una protección CSRF básica que requiere la presencia del encabezado `X-Requested-With`.

### Comando Base (Ejemplo)

Para generar una preferencia de pago simulando una petición AJAX desde un navegador:

```bash
curl -X POST http://localhost:9002/execute \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Authorization: Bearer <TU_TOKEN_DE_SESION>" \
  -d '{
    "cmd": "billing.create-preference",
    "params": {
      "plan": "pro",
      "amount": 30000,
      "tenantId": 2
    }
  }'
```

## Componentes Clave:

1.  `-H "X-Requested-With: XMLHttpRequest"`: **OBLIGATORIO**. El backend rechaza cualquier petición `POST`, `PUT`, `DELETE` que no incluya este encabezado.
2.  `-H "Content-Type: application/json"`: Necesario para que el cuerpo de la petición sea parseado correctamente.
3.  `-H "Authorization: Bearer <TOKEN>"` o cookies: Si el endpoint requiere autenticación, debes enviar el token de sesión obtenido tras el login. Si usas cookies, puedes usar `-b "session_token=<TOKEN>"`.

## Cómo obtener el Token de Sesión

Puedes obtener un token válido realizando un `login` previo mediante `curl`:

```bash
curl -X POST http://localhost:9002/execute \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "cmd": "USER:login",
    "params": { "username": "tu_usuario", "password": "tu_password" }
  }'
```
El token aparecerá en la respuesta `data.token`.
